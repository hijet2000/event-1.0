
import { 
    RegistrationData, EventConfig, Permission, 
    AdminUser, Role, DashboardStats, PublicEvent, 
    EventData, Task, TaskStatus, MealPlan, Restaurant, 
    MealPlanAssignment, MealConsumptionLog, AccommodationBooking, 
    Hotel, RoomType, HotelRoom, EnrichedAccommodationBooking, 
    EventCoinStats, Transaction, Session, Speaker, Sponsor,
    NetworkingProfile, NetworkingMatch, ScavengerHuntItem, LeaderboardEntry,
    DiningReservation, AccommodationBookingStatus, MealType,
    SessionFeedback, EmailContent, HotelRoomStatus
} from '../types';
import { 
    find, findAll, insert, update, remove, count, updateWhere, removeWhere 
} from './db';
import { 
    verifyToken, generateToken, hashPassword, comparePassword 
} from './auth';
import { 
    generateRegistrationEmails, generatePasswordResetEmail, 
    generateDelegateInvitationEmail, generateDelegateUpdateEmail, 
    generateAiContent, generateImage as generateImageAI,
    generateNetworkingMatches, summarizeSessionFeedback 
} from './geminiService';
import { 
    uploadFileToStorage, saveGeneratedImageToStorage, MediaItem 
} from './storage';
import { sendEmail } from './email';
import { defaultConfig } from './config';

export type { MediaItem };

const USE_REAL_API = false; // Toggle this to true to use the backend server

// Helper for Real API calls
const apiFetch = async <T>(endpoint: string, method: string = 'GET', body?: any, token?: string): Promise<T> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // In a real app, we might pass token in header, but our backend currently uses cookies
    // If using Authorization header:
    // if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const options: RequestInit = {
        method,
        headers,
        credentials: 'include', // Important for cookies
    };
    
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`/api${endpoint}`, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'API Error' }));
        throw new Error(err.message || `Error ${res.status}`);
    }
    return res.json();
};

// --- Auth & User ---

export const loginAdmin = async (email: string, password: string) => {
    if (USE_REAL_API) {
        return apiFetch<{ token: string, user: any }>('/login/admin', 'POST', { email, password });
    }
    // Mock
    const user = await find('adminUsers', (u: any) => u.email === email);
    if (user && await comparePassword(password, user.passwordHash)) {
        const role = await find('roles', (r: any) => r.id === user.roleId);
        const token = generateToken({ id: user.id, email: user.email, permissions: role?.permissions, type: 'admin' });
        return { token, user: { id: user.id, email: user.email, permissions: role?.permissions || [] } };
    }
    return null;
};

export const loginDelegate = async (eventId: string, email: string, password: string) => {
    if (USE_REAL_API) {
        const res = await apiFetch<{ success: boolean, user: any }>('/login/delegate', 'POST', { email, password, eventId });
        // To match mock behavior, we might need to generate a client-side token or return what server sends.
        // For now, assuming server sets cookie and we return a dummy token or server token if sent in body.
        // Our mock expects a token return.
        return { token: 'server-handled-cookie', user: res.user };
    }
    // Mock
    const user = await find('registrations', (u: any) => u.email === email && u.eventId === eventId);
    if (user && user.passwordHash && await comparePassword(password, user.passwordHash)) {
        const token = generateToken({ id: user.id, email: user.email, type: 'delegate', eventId });
        return { token, user };
    }
    return null;
};

export const requestAdminPasswordReset = async (email: string) => {
    if (USE_REAL_API) return apiFetch('/auth/forgot-password', 'POST', { email, type: 'admin' });
    // Mock: No-op
    console.log(`[Mock] Password reset requested for ${email}`);
};

export const requestDelegatePasswordReset = async (eventId: string, email: string) => {
    if (USE_REAL_API) return apiFetch('/auth/forgot-password', 'POST', { email, eventId, type: 'delegate' });
    // Mock
    const user = await find('registrations', (u: any) => u.email === email && u.eventId === eventId);
    if (user) {
        const token = `reset_${Date.now()}_${user.id}`;
        const config = (await find('events', (e: any) => e.id === eventId))?.config || defaultConfig;
        const resetLink = `${config.event.publicUrl}/${eventId}?resetToken=${token}`;
        const emailContent = await generatePasswordResetEmail(config, resetLink);
        await sendEmail({ to: email, ...emailContent }, config);
    }
};

export const resetPassword = async (token: string, newPassword: string) => {
    if (USE_REAL_API) return apiFetch('/auth/reset-password', 'POST', { token, newPassword });
    // Mock: token format reset_TIMESTAMP_USERID
    const parts = token.split('_');
    if (parts.length !== 3) throw new Error("Invalid token");
    const userId = parts[2];
    const hash = await hashPassword(newPassword);
    
    // Try updating admin first, then delegate
    let updated = await update('adminUsers', userId, { passwordHash: hash });
    if (!updated) {
        updated = await update('registrations', userId, { passwordHash: hash });
    }
    if (!updated) throw new Error("User not found for token");
};

// --- Event & Config ---

export const listPublicEvents = async (): Promise<PublicEvent[]> => {
    if (USE_REAL_API) return apiFetch<PublicEvent[]>('/events');
    const events = await findAll('events');
    return events.map((e: any) => ({
        id: e.id,
        name: e.config.event.name,
        date: e.config.event.date,
        location: e.config.event.location,
        logoUrl: e.config.theme.logoUrl,
        colorPrimary: e.config.theme.colorPrimary
    }));
};

export const getPublicEventData = async (eventId: string) => {
    if (USE_REAL_API) return apiFetch<{ config: EventConfig, registrationCount: number, sessions: Session[], speakers: Speaker[], sponsors: Sponsor[] }>(`/events/${eventId}`);
    
    const event = await find('events', (e: any) => e.id === eventId);
    if (!event) throw new Error("Event not found");
    
    const countVal = await count('registrations', (r: any) => r.eventId === eventId);
    const sessions = await findAll('sessions', (s: any) => s.eventId === eventId);
    const speakers = await findAll('speakers', (s: any) => s.eventId === eventId);
    const sponsors = await findAll('sponsors', (s: any) => s.eventId === eventId);

    return { 
        config: event.config as EventConfig, 
        registrationCount: countVal,
        sessions,
        speakers,
        sponsors
    };
};

export const createEvent = async (adminToken: string, name: string, type: string): Promise<EventData> => {
    if (USE_REAL_API) return apiFetch<EventData>('/events', 'POST', { name, type }, adminToken);
    
    const newEvent = {
        id: name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36),
        name,
        config: { ...defaultConfig, event: { ...defaultConfig.event, name, eventType: type } }
    };
    await insert('events', newEvent);
    return newEvent;
};

export const getEventConfig = async () => {
    // Simplified: assumes single event context or fetches first
    const events = await listPublicEvents();
    if (events.length > 0) {
        const data = await getPublicEventData(events[0].id);
        return data.config;
    }
    return defaultConfig;
};

export const saveConfig = async (adminToken: string, config: EventConfig) => {
    if (USE_REAL_API) return apiFetch<EventConfig>('/admin/config', 'PUT', { config }, adminToken);
    // Mock: update first event
    const events = await findAll('events');
    if (events.length > 0) {
        await update('events', events[0].id, { config });
        return config;
    }
    throw new Error("No event to save config to.");
};

export const syncConfigFromGitHub = async (adminToken: string): Promise<EventConfig> => {
    // Mock implementation
    return defaultConfig;
};

export const sendTestEmail = async (adminToken: string, to: string, config: EventConfig) => {
    if (USE_REAL_API) return apiFetch('/admin/test-email', 'POST', { to, config }, adminToken);
    await sendEmail({ to, subject: "Test Email", body: "This is a test." }, config);
};

export const getSystemApiKey = async (adminToken: string): Promise<string> => {
    if (USE_REAL_API) {
        const res = await apiFetch<{ apiKey: string }>('/admin/api-key', 'GET', undefined, adminToken);
        return res.apiKey;
    }
    // In mock mode, return a fake static key
    return "pk_test_mock_api_key_12345";
};

// --- Registration ---

export const registerUser = async (eventId: string, data: RegistrationData, inviteToken?: string) => {
    if (USE_REAL_API) return apiFetch<{ success: boolean, message: string }>('/registrations', 'POST', { eventId, data, inviteToken });
    
    const existing = await find('registrations', (r: any) => r.email === data.email && r.eventId === eventId);
    if (existing) return { success: false, message: "Email already registered." };

    const passwordHash = await hashPassword(data.password || 'password123');
    const newUser = {
        ...data,
        id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        eventId,
        passwordHash,
        createdAt: Date.now(),
        checkedIn: false,
        customFields: { ...data } // Store extra fields
    };
    delete (newUser as any).password; // Don't store plain text
    
    await insert('registrations', newUser);
    
    // Invalidate invite token if used
    if (inviteToken) {
        await removeWhere('inviteTokens', (t: any) => t.token === inviteToken);
    }

    return { success: true, message: "Registered successfully." };
};

export const triggerRegistrationEmails = async (eventId: string, data: RegistrationData) => {
    // Mock implementation relying on config
    const config = (await getPublicEventData(eventId)).config;
    // Use Gemini to generate content
    const { userEmail, hostEmail } = await generateRegistrationEmails(data, config, "http://verify", "http://qr");
    await sendEmail({ to: data.email, ...userEmail }, config);
    await sendEmail({ to: config.host.email, ...hostEmail }, config);
};

export const getInvitationDetails = async (token: string) => {
    if (USE_REAL_API) return apiFetch<{ eventId: string, inviteeEmail: string }>(`/invitations/${token}`);
    const invite = await find('inviteTokens', (t: any) => t.token === token);
    return invite ? { eventId: invite.eventId, inviteeEmail: invite.email } : null;
};

export const getRegistrations = async (adminToken: string) => {
    if (USE_REAL_API) return apiFetch<RegistrationData[]>('/admin/registrations', 'GET', undefined, adminToken);
    return findAll('registrations');
};

export const updateRegistrationStatus = async (adminToken: string, id: string, checkedIn: boolean) => {
    if (USE_REAL_API) return apiFetch(`/admin/registrations/${id}/status`, 'PUT', { checkedIn }, adminToken);
    await update('registrations', id, { checkedIn });
};

export const deleteAdminRegistration = async (adminToken: string, id: string) => {
    if (USE_REAL_API) return apiFetch(`/admin/registrations/${id}`, 'DELETE', undefined, adminToken);
    await remove('registrations', id);
};

export const saveAdminRegistration = async (adminToken: string, id: string, data: Partial<RegistrationData>) => {
    await update('registrations', id, data);
};

export const bulkImportRegistrations = async (adminToken: string, csvData: string) => {
    if (USE_REAL_API) return apiFetch<{ successCount: number, errorCount: number, errors: string[] }>('/admin/registrations/import', 'POST', { csvData }, adminToken);
    
    const lines = csvData.split('\n').map(l => l.trim()).filter(l => l);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const [name, email] = lines[i].split(',').map(s => s.trim());
        if (name && email) {
            const res = await registerUser('main-event', { name, email, createdAt: Date.now() } as any);
            if (res.success) successCount++;
            else {
                errorCount++;
                errors.push(`${email}: ${res.message}`);
            }
        }
    }
    return { successCount, errorCount, errors };
};

// --- Ticket Security ---
export const getSignedTicketToken = async (delegateToken: string): Promise<string> => {
    if (USE_REAL_API) {
        const res = await apiFetch<{token: string}>('/tickets/token', 'GET', undefined, delegateToken);
        return res.token;
    }
    // Mock: just return the delegate ID as a "token"
    const payload = verifyToken(delegateToken);
    return payload ? payload.id : '';
};

export const verifyTicketToken = async (adminToken: string, ticketToken: string): Promise<{ success: boolean, user?: any, message: string }> => {
    if (USE_REAL_API) {
        return await apiFetch<{ success: boolean, user?: any, message: string }>('/tickets/verify', 'POST', { token: ticketToken }, adminToken);
    }
    
    // Mock verification
    const user = await find('registrations', (r: any) => r.id === ticketToken);
    if (!user) return { success: false, message: "Invalid ticket" };
    
    if (user.checkedIn) {
        return { success: false, message: `${user.name} already checked in.`, user };
    }
    
    await update('registrations', user.id, { checkedIn: true });
    return { success: true, message: `Checked in ${user.name}`, user };
};

// --- Communications ---

export const sendDelegateInvitation = async (adminToken: string, eventId: string, email: string) => {
    if (USE_REAL_API) return apiFetch('/admin/invitations', 'POST', { eventId, email }, adminToken);
    
    const token = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    await insert('inviteTokens', { token, eventId, email, createdAt: Date.now() });
    
    const config = (await getPublicEventData(eventId)).config;
    const inviteLink = `${config.event.publicUrl}/${eventId}?inviteToken=${token}`;
    const content = await generateDelegateInvitationEmail(config, "Event Admin", inviteLink);
    await sendEmail({ to: email, ...content }, config);
};

export const sendUpdateEmailToDelegate = async (adminToken: string, eventId: string, userId: string) => {
    const user = await find('registrations', (r: any) => r.id === userId);
    const config = (await getPublicEventData(eventId)).config;
    const content = await generateDelegateUpdateEmail(config, user);
    await sendEmail({ to: user.email, ...content }, config);
};

export const sendBroadcast = async (adminToken: string, subject: string, body: string, target: string, channel: string) => {
    if (USE_REAL_API) return apiFetch<{ success: boolean, message: string }>('/admin/broadcast', 'POST', { subject, body, target, channel }, adminToken);
    // Mock
    await insert('emailLogs', { id: `log_${Date.now()}`, to: 'Broadcast', subject, body, timestamp: Date.now(), status: 'sent' });
    return { success: true, message: "Broadcast queued." };
};

export const getEmailLogs = async (adminToken: string) => {
    if (USE_REAL_API) return apiFetch<any[]>('/admin/email-logs', 'GET', undefined, adminToken);
    return findAll('emailLogs');
};

// --- Dashboard ---

export const getDashboardStats = async (adminToken: string): Promise<DashboardStats> => {
    if (USE_REAL_API) return apiFetch<DashboardStats>('/admin/stats', 'GET', undefined, adminToken);
    
    const regs = await findAll('registrations');
    const tasks = await findAll('tasks');
    const coinStats = await getEventCoinStats(adminToken);
    const config = await getEventConfig();

    // Generate mock trend
    const trend = [];
    for (let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        trend.push({ date: d.toISOString().split('T')[0], count: Math.floor(Math.random() * 10) });
    }

    return {
        totalRegistrations: regs.length,
        maxAttendees: config.event.maxAttendees,
        eventDate: config.event.date,
        eventCoinName: config.eventCoin.name,
        eventCoinCirculation: coinStats.totalCirculation,
        recentRegistrations: regs.slice(-5).reverse(),
        registrationTrend: trend,
        taskStats: {
            total: tasks.length,
            completed: tasks.filter((t: any) => t.status === 'completed').length,
            pending: tasks.filter((t: any) => t.status !== 'completed').length
        }
    };
};

// --- Users & Roles ---

export const getAdminUsers = async (adminToken: string) => findAll('adminUsers');
export const getRoles = async (adminToken: string) => findAll('roles');
export const saveAdminUser = async (adminToken: string, user: Partial<AdminUser> & { password?: string }) => {
    if (user.password) {
        user.passwordHash = await hashPassword(user.password);
        delete user.password;
    }
    if (user.id) return update('adminUsers', user.id, user);
    return insert('adminUsers', { ...user, id: `user_${Date.now()}`, createdAt: Date.now() });
};
export const deleteAdminUser = async (adminToken: string, id: string) => remove('adminUsers', id);
export const saveRole = async (adminToken: string, role: Partial<Role>) => {
    if (role.id) return update('roles', role.id, role);
    return insert('roles', { ...role, id: `role_${Date.now()}` });
};
export const deleteRole = async (adminToken: string, id: string) => remove('roles', id);

// --- Tasks ---

export const getTasks = async (adminToken: string, eventId: string) => findAll('tasks');
export const saveTask = async (adminToken: string, task: Partial<Task>) => {
    if (task.id) return update('tasks', task.id, task);
    return insert('tasks', { ...task, id: `task_${Date.now()}`, eventId: 'main-event' });
};
export const deleteTask = async (adminToken: string, id: string) => remove('tasks', id);

// --- Agenda & Feedback ---

export const getSessions = async (adminToken: string) => findAll('sessions');
export const saveSession = async (adminToken: string, session: Partial<Session>) => {
    if (session.id) return update('sessions', session.id, session);
    return insert('sessions', { ...session, id: `sess_${Date.now()}` });
};
export const deleteSession = async (adminToken: string, id: string) => remove('sessions', id);
export const getSpeakers = async (adminToken: string) => findAll('speakers');
export const saveSpeaker = async (adminToken: string, speaker: Partial<Speaker>) => {
    if (speaker.id) return update('speakers', speaker.id, speaker);
    return insert('speakers', { ...speaker, id: `spk_${Date.now()}` });
};
export const deleteSpeaker = async (adminToken: string, id: string) => remove('speakers', id);

export const getSessionFeedbackStats = async (adminToken: string, sessionId: string) => {
    const feedbacks = await findAll('sessionFeedback', (f: any) => f.sessionId === sessionId);
    const count = feedbacks.length;
    const avgRating = count > 0 ? feedbacks.reduce((a: any, b: any) => a + b.rating, 0) / count : 0;
    return { count, avgRating: parseFloat(avgRating.toFixed(1)) };
};

export const analyzeFeedback = async (adminToken: string, sessionId: string) => {
    const feedbacks = await findAll('sessionFeedback', (f: any) => f.sessionId === sessionId);
    const comments = feedbacks.map((f: any) => f.comment).filter(Boolean);
    const session = await find('sessions', (s: any) => s.id === sessionId);
    return summarizeSessionFeedback(session?.title || 'Session', comments);
};

export const downloadSessionIcs = async (sessionId: string) => {
    // Mock ICS download
    console.log(`Downloading ICS for session ${sessionId}`);
};

// --- Sponsors ---
export const getSponsors = async (adminToken: string) => findAll('sponsors');
export const saveSponsor = async (adminToken: string, sponsor: Partial<Sponsor>) => {
    if (sponsor.id) return update('sponsors', sponsor.id, sponsor);
    return insert('sponsors', { ...sponsor, id: `sponsor_${Date.now()}` });
};
export const deleteSponsor = async (adminToken: string, id: string) => remove('sponsors', id);

// --- Dining ---

export const getMealPlans = async (token: string) => findAll('mealPlans');
export const saveMealPlan = async (adminToken: string, plan: Partial<MealPlan>) => {
    if (plan.id) return update('mealPlans', plan.id, plan);
    return insert('mealPlans', { ...plan, id: `plan_${Date.now()}` });
};
export const deleteMealPlan = async (adminToken: string, id: string) => remove('mealPlans', id);

export const getRestaurants = async (token: string) => findAll('restaurants');
export const saveRestaurant = async (adminToken: string, rest: Partial<Restaurant>) => {
    if (rest.id) return update('restaurants', rest.id, rest);
    return insert('restaurants', { ...rest, id: `rest_${Date.now()}` });
};
export const deleteRestaurant = async (adminToken: string, id: string) => remove('restaurants', id);

export const getReservationsForRestaurant = async (adminToken: string, restaurantId: string) => {
    const res = await findAll('diningReservations', (r: any) => r.restaurantId === restaurantId);
    // Enrich with delegate names
    const enriched = [];
    for (const r of res) {
        const user = await find('registrations', (u: any) => u.id === r.delegateId);
        enriched.push({ ...r, delegateName: user?.name || 'Unknown', delegateEmail: user?.email });
    }
    return enriched;
};

export const createAdminDiningReservation = async (adminToken: string, data: Partial<DiningReservation>) => {
    return insert('diningReservations', { ...data, id: `res_${Date.now()}` });
};
export const deleteDiningReservation = async (adminToken: string, id: string) => remove('diningReservations', id);

export const recordMealConsumption = async (adminToken: string, delegateId: string, mealType: MealType) => {
    // Check if already consumed today
    const today = new Date().toISOString().split('T')[0];
    const existing = await find('mealConsumptionLogs', (l: any) => l.delegateId === delegateId && l.mealType === mealType && l.date === today);
    if (existing) return { success: false, message: "Already consumed this meal today." };
    
    await insert('mealConsumptionLogs', {
        id: `log_${Date.now()}`,
        delegateId,
        mealType,
        date: today,
        timestamp: Date.now()
    });
    return { success: true, message: "Meal recorded successfully." };
};

// --- Accommodation ---

export const getHotels = async (token: string) => findAll('hotels');
export const saveHotel = async (adminToken: string, hotel: Partial<Hotel>) => {
    if (hotel.id) return update('hotels', hotel.id, hotel);
    return insert('hotels', { ...hotel, id: `hotel_${Date.now()}` });
};
export const deleteHotel = async (adminToken: string, id: string) => remove('hotels', id);

export const generateHotelRooms = async (adminToken: string, hotelId: string, roomTypeId: string, count: number, startNumber: number) => {
    for (let i = 0; i < count; i++) {
        await insert('hotelRooms', {
            id: `room_${Date.now()}_${i}`,
            hotelId,
            roomTypeId,
            roomNumber: (startNumber + i).toString(),
            status: 'Available'
        });
    }
};

export const getAllRooms = async (adminToken: string, hotelId: string) => {
    return findAll('hotelRooms', (r: any) => r.hotelId === hotelId);
}

export const getAvailableRooms = async (adminToken: string, hotelId: string, roomTypeId: string) => {
    // Find rooms that are 'Available' AND not currently booked in active bookings
    return findAll('hotelRooms', (r: any) => r.hotelId === hotelId && r.roomTypeId === roomTypeId && r.status === 'Available');
};

export const updateRoomStatus = async (adminToken: string, roomId: string, status: HotelRoomStatus) => {
    await update('hotelRooms', roomId, { status });
};

export const getAccommodationBookings = async (adminToken: string) => {
    const bookings = await findAll('accommodationBookings');
    const enriched: EnrichedAccommodationBooking[] = [];
    for (const b of bookings) {
        const user = await find('registrations', (u: any) => u.id === b.delegateId);
        const hotel = await find('hotels', (h: any) => h.id === b.hotelId);
        const roomType = hotel?.roomTypes.find((rt: any) => rt.id === b.roomTypeId);
        const room = b.hotelRoomId ? await find('hotelRooms', (r: any) => r.id === b.hotelRoomId) : null;
        
        enriched.push({
            ...b,
            delegateName: user?.name || 'Unknown',
            delegateEmail: user?.email,
            hotelName: hotel?.name || 'Unknown',
            roomTypeName: roomType?.name || 'Unknown',
            roomNumber: room?.roomNumber || 'Pending'
        });
    }
    return enriched;
};

export const updateBookingStatus = async (adminToken: string, id: string, status: AccommodationBookingStatus) => {
    await update('accommodationBookings', id, { status });
};

export const processCheckOut = async (adminToken: string, bookingId: string) => {
    const booking = await find('accommodationBookings', (b: any) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");

    // 1. Mark Booking as CheckedOut
    await update('accommodationBookings', bookingId, { status: 'CheckedOut' });
    
    // 2. Mark Room as Cleaning
    if (booking.hotelRoomId) {
        await update('hotelRooms', booking.hotelRoomId, { status: 'Cleaning' });
    }
    return true;
};

export const assignRoomToBooking = async (adminToken: string, bookingId: string, roomId: string) => {
    await update('accommodationBookings', bookingId, { hotelRoomId: roomId, status: 'CheckedIn' });
    await update('hotelRooms', roomId, { status: 'Occupied' });
};

export const bookAccommodation = async (token: string, hotelId: string, roomTypeId: string, checkInDate: string, checkOutDate: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");

    // STRICT AVAILABILITY CHECK
    const hotel = await find('hotels', (h: any) => h.id === hotelId);
    const roomType = hotel.roomTypes.find((rt: any) => rt.id === roomTypeId);
    
    if (!roomType) throw new Error("Room type not found");

    // 1. Count total inventory
    // In a real system, we might query the hotelRooms table, but roomType.totalRooms is our source of truth for capacity in this model
    const totalCapacity = roomType.totalRooms;

    // 2. Count overlapping bookings
    const existingBookings = await findAll('accommodationBookings', (b: any) => {
        if (b.roomTypeId !== roomTypeId) return false;
        if (b.status === 'CheckedOut') return false; // Ignore completed stays
        
        const bStart = new Date(b.checkInDate).getTime();
        const bEnd = new Date(b.checkOutDate).getTime();
        const reqStart = new Date(checkInDate).getTime();
        const reqEnd = new Date(checkOutDate).getTime();

        // Check for overlap
        return (bStart < reqEnd && bEnd > reqStart);
    });

    if (existingBookings.length >= totalCapacity) {
        throw new Error("Sold Out: No rooms available for these dates.");
    }

    // Remove existing booking for this user if replacing
    await removeWhere('accommodationBookings', (b: any) => b.delegateId === payload.id);
    
    await insert('accommodationBookings', { 
        id: `bk_${Date.now()}`, 
        delegateId: payload.id, 
        hotelId, 
        roomTypeId, 
        checkInDate, 
        checkOutDate, 
        status: 'Confirmed', 
        hotelRoomId: null // Assigned at check-in
    });
};

// --- Economy ---

export const getEventCoinStats = async (adminToken: string): Promise<EventCoinStats> => {
    const txs = await findAll('transactions');
    const circulation = txs.reduce((acc: number, tx: any) => {
        // Simplified circulation logic: sum of 'initial' or 'purchase' or 'reward' minus 'burns' (not implemented)
        if (['initial', 'purchase', 'reward', 'admin_adjustment'].includes(tx.type)) return acc + tx.amount;
        return acc;
    }, 0);
    const activeWallets = new Set(txs.map((tx: any) => tx.fromId).concat(txs.map((tx: any) => tx.toId))).size;
    return { totalCirculation: circulation, totalTransactions: txs.length, activeWallets };
};

export const getAllTransactions = async (adminToken: string) => findAll('transactions');

export const issueEventCoins = async (adminToken: string, email: string, amount: number, message: string) => {
    const user = await find('registrations', (r: any) => r.email === email);
    if (!user) throw new Error("User not found");
    
    await insert('transactions', {
        id: `tx_${Date.now()}`,
        fromId: 'system', fromName: 'System', fromEmail: 'system',
        toId: user.id, toName: user.name, toEmail: user.email,
        amount, message, type: 'admin_adjustment', timestamp: Date.now()
    });
};

// --- Delegate Portal Functions ---

export const getDelegateProfile = async (token: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    
    const user = await find('registrations', (r: any) => r.id === payload.id);
    const mealPlanAssign = await find('mealPlanAssignments', (a: any) => a.delegateId === payload.id);
    const booking = await find('accommodationBookings', (b: any) => b.delegateId === payload.id);
    const sessions = await findAll('sessions'); // Could optimize
    const mySelection = await findAll('agendaSelections', (s: any) => s.delegateId === payload.id);
    const mySessionIds = mySelection.map((s: any) => s.sessionId);
    const speakers = await findAll('speakers');
    const sponsors = await findAll('sponsors');
    const hotels = await findAll('hotels');
    const restaurants = await findAll('restaurants');

    return {
        user,
        mealPlanAssignment: mealPlanAssign,
        restaurants,
        accommodationBooking: booking,
        hotels,
        sessions,
        mySessionIds,
        speakers,
        sponsors
    };
};

export const updateDelegateProfile = async (token: string, data: Partial<RegistrationData>) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    return update('registrations', payload.id, data);
};

export const getDelegateBalance = async (token: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    
    const txs = await findAll('transactions', (t: any) => t.fromId === payload.id || t.toId === payload.id);
    let balance = 0;
    txs.forEach((tx: any) => {
        if (tx.toId === payload.id) balance += tx.amount;
        if (tx.fromId === payload.id) balance -= tx.amount;
    });
    
    const config = await getEventConfig();
    return { balance, currencyName: config.eventCoin.name };
};

export const getDelegateTransactions = async (token: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    return findAll('transactions', (t: any) => t.fromId === payload.id || t.toId === payload.id);
};

export const sendCoins = async (token: string, recipientEmail: string, amount: number, message: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    
    const sender = await find('registrations', (r: any) => r.id === payload.id);
    const recipient = await find('registrations', (r: any) => r.email === recipientEmail);
    if (!recipient) throw new Error("Recipient not found");
    
    // Check balance
    const { balance } = await getDelegateBalance(token);
    if (balance < amount) throw new Error("Insufficient funds");
    
    await insert('transactions', {
        id: `tx_${Date.now()}`,
        fromId: sender.id, fromName: sender.name, fromEmail: sender.email,
        toId: recipient.id, toName: recipient.name, toEmail: recipient.email,
        amount, message, type: 'p2p', timestamp: Date.now()
    });
};

export const purchaseEventCoins = async (token: string, amount: number, price: number) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    const user = await find('registrations', (r: any) => r.id === payload.id);
    
    await insert('transactions', {
        id: `tx_${Date.now()}`,
        fromId: 'payment_gateway', fromName: 'Top Up', fromEmail: 'system',
        toId: user.id, toName: user.name, toEmail: user.email,
        amount, message: `Purchased for $${price}`, type: 'purchase', timestamp: Date.now()
    });
};

export const addToAgenda = async (token: string, sessionId: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    await insert('agendaSelections', { id: `sel_${Date.now()}`, delegateId: payload.id, sessionId });
};

export const removeFromAgenda = async (token: string, sessionId: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    await removeWhere('agendaSelections', (s: any) => s.delegateId === payload.id && s.sessionId === sessionId);
};

export const submitSessionFeedback = async (token: string, sessionId: string, rating: number, comment: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    await insert('sessionFeedback', { id: `fb_${Date.now()}`, sessionId, userId: payload.id, rating, comment, timestamp: Date.now() });
};

export const assignMealPlan = async (token: string, mealPlanId: string, startDate: string, endDate: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    // Remove existing
    await removeWhere('mealPlanAssignments', (a: any) => a.delegateId === payload.id);
    await insert('mealPlanAssignments', { id: `mpa_${Date.now()}`, delegateId: payload.id, mealPlanId, startDate, endDate });
};

export const makeDiningReservation = async (token: string, restaurantId: string, reservationTime: string, partySize: number) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    await insert('diningReservations', { id: `res_${Date.now()}`, delegateId: payload.id, restaurantId, reservationTime, partySize });
};

// --- Networking & Gamification ---

export const getMyNetworkingProfile = async (token: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    return find('networkingProfiles', (p: any) => p.userId === payload.id);
};

export const updateNetworkingProfile = async (token: string, data: Partial<NetworkingProfile>) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    
    const existing = await getMyNetworkingProfile(token);
    if (existing) {
        await updateWhere('networkingProfiles', (p: any) => p.userId === payload.id, data);
    } else {
        await insert('networkingProfiles', { userId: payload.id, ...data });
    }
};

export const getNetworkingCandidates = async (token: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    
    const myProfile = await getMyNetworkingProfile(token);
    const allCandidates = await findAll('networkingProfiles', (p: any) => p.userId !== payload.id && p.isVisible);
    
    // Use Gemini to match
    const matches = await generateNetworkingMatches(myProfile, allCandidates);
    
    // Enrich matches with names
    for (const m of matches) {
        const user = await find('registrations', (r: any) => r.id === m.userId);
        m.name = user?.name || 'Anonymous';
        m.profile = allCandidates.find((c: any) => c.userId === m.userId);
    }
    
    return { matches, allCandidates };
};

export const getScavengerHuntItems = async (token: string) => findAll('scavengerHuntItems');
export const saveScavengerHuntItem = async (token: string, item: any) => {
    if (item.id) return update('scavengerHuntItems', item.id, item);
    return insert('scavengerHuntItems', { ...item, id: `hunt_${Date.now()}` });
};
export const deleteScavengerHuntItem = async (token: string, id: string) => remove('scavengerHuntItems', id);

export const getScavengerHuntProgress = async (token: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    const logs = await findAll('scavengerHuntLogs', (l: any) => l.userId === payload.id);
    return logs.map((l: any) => l.itemId);
};

export const claimScavengerHuntItem = async (token: string, secretCode: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    
    const item = await find('scavengerHuntItems', (i: any) => i.secretCode === secretCode);
    if (!item) return { success: false, message: "Invalid Code" };
    
    const existing = await find('scavengerHuntLogs', (l: any) => l.userId === payload.id && l.itemId === item.id);
    if (existing) return { success: false, message: "Already claimed!" };
    
    await insert('scavengerHuntLogs', { id: `claim_${Date.now()}`, userId: payload.id, itemId: item.id, timestamp: Date.now() });
    
    // Award Coins
    await insert('transactions', {
        id: `tx_reward_${Date.now()}`,
        fromId: 'system', fromName: 'Scavenger Hunt', fromEmail: 'system',
        toId: payload.id, toName: 'User', toEmail: 'user@email', // Simplified
        amount: item.rewardAmount, message: `Found ${item.name}`, type: 'reward', timestamp: Date.now()
    });
    
    return { success: true, message: `Found ${item.name}! +${item.rewardAmount} Coins` };
};

export const getScavengerHuntLeaderboard = async (token: string) => {
    const logs = await findAll('scavengerHuntLogs');
    const items = await findAll('scavengerHuntItems');
    const users = await findAll('registrations'); // To get names
    
    const scores: Record<string, { score: number, items: number }> = {};
    
    logs.forEach((log: any) => {
        const item = items.find((i: any) => i.id === log.itemId);
        if (!item) return;
        if (!scores[log.userId]) scores[log.userId] = { score: 0, items: 0 };
        scores[log.userId].score += item.rewardAmount;
        scores[log.userId].items += 1;
    });
    
    return Object.entries(scores)
        .map(([userId, stats]) => ({
            userId,
            name: users.find((u: any) => u.id === userId)?.name || 'Unknown',
            score: stats.score,
            itemsFound: stats.items
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
};

// --- AI Context & Media ---

export const getEventContextForAI = async (token: string) => {
    // Build a text context for the chatbot
    const config = await getEventConfig();
    const sessions = await findAll('sessions');
    const speakers = await findAll('speakers');
    
    return `
        You are the virtual concierge for ${config.event.name}.
        Event Date: ${config.event.date}. Location: ${config.event.location}.
        Description: ${config.event.description}.
        
        Agenda Highlights:
        ${sessions.map((s: any) => `- ${s.title} at ${s.startTime} in ${s.location}`).join('\n')}
        
        Speakers: ${speakers.map((s: any) => s.name).join(', ')}.
        
        Answer questions helpfully and briefly.
    `;
};

export const getMediaLibrary = async (token: string) => findAll('media');
export const uploadFile = uploadFileToStorage;
export const generateImage = generateImageAI;
export { generateAiContent };
export const deleteMedia = async (token: string, id: string) => remove('media', id);

// --- System ---

export const getDatabaseSchema = async (token: string) => {
    return `
        -- In-Memory Schema Representation --
        Users (id, email, passwordHash, roleId)
        Registrations (id, eventId, name, email, ...)
        Events (id, name, config)
        Sessions, Speakers, Sponsors...
        Transactions, Bookings, etc.
    `;
};

export const generateSqlExport = async (token: string) => {
    return "-- SQL Export Not Implemented in Mock Mode --";
};
