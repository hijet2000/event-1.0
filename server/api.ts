
import { 
    RegistrationData, EventConfig, Permission, DashboardStats, AdminUser, 
    Role, PublicEvent, Task, MealPlan, Restaurant, MealType, 
    MealPlanAssignment, AccommodationBooking, Hotel, RoomType, 
    EnrichedAccommodationBooking, AccommodationBookingStatus, HotelRoom, 
    HotelRoomStatus, DiningReservation, AppNotification, SessionQuestion, 
    TicketTier, NetworkingProfile, NetworkingMatch, ScavengerHuntItem, 
    LeaderboardEntry, ChatMessage, ChatConversation, MediaItem, VenueMap,
    Speaker, Session, Sponsor, EventCoinStats, Transaction, EventData
} from '../types';
import { defaultConfig } from './config';
import * as db from './db';
import { generateToken, verifyToken } from './auth';
import { uploadFileToStorage, saveGeneratedImageToStorage } from './storage';
import { getEnv } from './env';
import { generateImage as geminiGenerateImage, generateAiContent as geminiGenerateContent } from './geminiService';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- AUTH & ADMIN ---

export const initializeApi = async (force?: boolean) => {
    // Mock connection check
    await delay(500);
    return true;
};

export const isBackendConnected = () => true;
export const setForceOffline = () => {};

export const loginAdmin = async (email: string, password: string): Promise<{ token: string, user: any } | null> => {
    const users = await db.findAll('admin_users');
    const user = users.find((u: any) => u.email === email);
    // In mock, simple password check
    if (user && password === 'password') { 
        const role = (await db.find('roles', (r: any) => r.id === user.roleId)) || { permissions: [] };
        const token = generateToken({ id: user.id, email: user.email, permissions: role.permissions, type: 'admin' });
        return { token, user: { ...user, permissions: role.permissions } };
    }
    return null;
};

export const requestAdminPasswordReset = async (email: string) => { await delay(500); };

export const getAdminUsers = async (token: string): Promise<AdminUser[]> => await db.findAll('admin_users');
export const saveAdminUser = async (token: string, user: any) => {
    if (user.id) await db.update('admin_users', user.id, user);
    else await db.insert('admin_users', { ...user, id: `user_${Date.now()}`, createdAt: Date.now() });
};
export const deleteAdminUser = async (token: string, id: string) => await db.remove('admin_users', id);

export const getRoles = async (token: string): Promise<Role[]> => await db.findAll('roles');
export const saveRole = async (token: string, role: any) => {
    if (role.id) await db.update('roles', role.id, role);
    else await db.insert('roles', { ...role, id: `role_${Date.now()}` });
};
export const deleteRole = async (token: string, id: string) => await db.remove('roles', id);

// --- EVENTS & CONFIG ---

export const listPublicEvents = async (): Promise<PublicEvent[]> => {
    const events = await db.findAll('events');
    return events.map((e: any) => ({ ...e, config: e.config || defaultConfig }));
};

export const createEvent = async (token: string, name: string, type: string): Promise<EventData> => {
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
    const event = await db.find('events', (e: any) => e.id === eventId);
    return event?.config || defaultConfig;
};

export const saveConfig = async (token: string, config: EventConfig) => {
    const event = await db.find('events', (e: any) => true); // Just grab first for mock
    if (event) await db.update('events', event.id, { config });
    return config;
};

export const syncConfigFromGitHub = async (token: string) => defaultConfig;
export const getSystemApiKey = async (token: string) => "mock-api-key-12345";
export const getDatabaseSchema = async (token: string) => "-- Schema\nCREATE TABLE users...";
export const generateSqlExport = async (token: string) => "-- Export\nINSERT INTO users...";

// --- PUBLIC & REGISTRATION ---

export const getPublicEventData = async (eventId: string) => {
    const config = await getEventConfig(eventId);
    const sessions = await db.findAll('sessions');
    const speakers = await db.findAll('speakers');
    const sponsors = await db.findAll('sponsors');
    const registrations = await db.findAll('registrations');
    return { config, sessions, speakers, sponsors, registrationCount: registrations.length };
};

export const registerUser = async (eventId: string, data: RegistrationData, inviteToken?: string): Promise<{ success: boolean; message: string }> => {
    const exists = await db.find('registrations', (r: any) => r.email === data.email);
    if (exists) return { success: false, message: 'Email already registered.' };
    
    await db.insert('registrations', { 
        ...data, 
        id: `reg_${Date.now()}`, 
        eventId, 
        createdAt: Date.now(),
        checkedIn: false 
    });
    return { success: true, message: 'Registered successfully' };
};

export const triggerRegistrationEmails = async (eventId: string, data: RegistrationData) => { await delay(500); };
export const getInvitationDetails = async (token: string) => ({ eventId: 'main-event', inviteeEmail: 'test@example.com' });

export const loginDelegate = async (eventId: string, email: string, password: string) => {
    const user = await db.find('registrations', (r: any) => r.email === email);
    if (user) {
        // Mock password check (any password works for now as we don't have delegate password set flow in mock)
        return { token: generateToken({ id: user.id, email: user.email, type: 'delegate', eventId }) };
    }
    return null;
};

export const requestDelegatePasswordReset = async (eventId: string, email: string) => { await delay(500); };
export const resetPassword = async (token: string, password: string) => { await delay(500); };

export const getRegistrations = async (token: string): Promise<RegistrationData[]> => await db.findAll('registrations');
export const updateRegistrationStatus = async (token: string, id: string, status: any) => await db.update('registrations', id, status);
export const deleteAdminRegistration = async (token: string, id: string) => await db.remove('registrations', id);
export const saveAdminRegistration = async (token: string, id: string, data: any) => await db.update('registrations', id, data);
export const bulkImportRegistrations = async (token: string, csvData: string) => {
    const lines = csvData.trim().split('\n').slice(1); // skip header
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
    // Mock verification
    return { success: true, message: "Ticket Valid", user: { id: ticketToken } }; 
};
export const getSignedTicketToken = async (token: string) => {
    const payload = verifyToken(token);
    return payload?.id || '';
};

export const getDelegateProfile = async (token: string) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    const user = await db.find('registrations', (r: any) => r.id === payload.id);
    return { user };
};

export const updateDelegateProfile = async (token: string, data: Partial<RegistrationData>) => {
    const payload = verifyToken(token);
    if (!payload) throw new Error("Invalid token");
    return await db.update('registrations', payload.id, data);
};

// --- DASHBOARD ---

export const getDashboardStats = async (token: string): Promise<DashboardStats> => {
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

// --- AGENDA & SESSIONS ---

export const getSessions = async (token: string): Promise<Session[]> => await db.findAll('sessions');
export const saveSession = async (token: string, session: any) => {
    if (session.id) await db.update('sessions', session.id, session);
    else await db.insert('sessions', { ...session, id: `sess_${Date.now()}` });
};
export const deleteSession = async (token: string, id: string) => await db.remove('sessions', id);

export const getSpeakers = async (token: string): Promise<Speaker[]> => await db.findAll('speakers');
export const saveSpeaker = async (token: string, speaker: any) => {
    if (speaker.id) await db.update('speakers', speaker.id, speaker);
    else await db.insert('speakers', { ...speaker, id: `spk_${Date.now()}` });
};
export const deleteSpeaker = async (token: string, id: string) => await db.remove('speakers', id);

export const getSponsors = async (token: string): Promise<Sponsor[]> => await db.findAll('sponsors');
export const saveSponsor = async (token: string, sponsor: any) => {
    if (sponsor.id) await db.update('sponsors', sponsor.id, sponsor);
    else await db.insert('sponsors', { ...sponsor, id: `spo_${Date.now()}` });
};
export const deleteSponsor = async (token: string, id: string) => await db.remove('sponsors', id);

export const addToAgenda = async (token: string, sessionId: string) => {
    // Mock agenda storage
    await delay(200);
};
export const removeFromAgenda = async (token: string, sessionId: string) => { await delay(200); };
export const submitSessionFeedback = async (token: string, sessionId: string, rating: number, comment: string) => { await delay(200); };
export const getSessionFeedbackStats = async (token: string, sessionId: string) => ({ count: 5, avgRating: 4.5 });
export const analyzeFeedback = async (token: string, sessionId: string) => "Great session overall.";
export const downloadSessionIcs = async (sessionId: string) => {};

export const getSessionQuestions = async (token: string, sessionId: string): Promise<SessionQuestion[]> => [];
export const submitSessionQuestion = async (token: string, sessionId: string, text: string) => {};
export const upvoteSessionQuestion = async (token: string, questionId: string) => {};

// --- DINING & ACCOMMODATION ---

export const getMealPlans = async (token: string): Promise<MealPlan[]> => await db.findAll('meal_plans');
export const saveMealPlan = async (token: string, plan: any) => {
    if (plan.id) await db.update('meal_plans', plan.id, plan);
    else await db.insert('meal_plans', { ...plan, id: `mp_${Date.now()}` });
};
export const deleteMealPlan = async (token: string, id: string) => await db.remove('meal_plans', id);

export const getRestaurants = async (token: string): Promise<Restaurant[]> => await db.findAll('restaurants');
export const saveRestaurant = async (token: string, rest: any) => {
    if (rest.id) await db.update('restaurants', rest.id, rest);
    else await db.insert('restaurants', { ...rest, id: `rst_${Date.now()}` });
};
export const deleteRestaurant = async (token: string, id: string) => await db.remove('restaurants', id);

export const getHotels = async (token: string): Promise<Hotel[]> => await db.findAll('hotels');
export const saveHotel = async (token: string, hotel: any) => {
    if (hotel.id) await db.update('hotels', hotel.id, hotel);
    else await db.insert('hotels', { ...hotel, id: `htl_${Date.now()}` });
};
export const deleteHotel = async (token: string, id: string) => await db.remove('hotels', id);

export const getAccommodationBookings = async (token: string): Promise<EnrichedAccommodationBooking[]> => {
    const bookings = await db.findAll('bookings');
    // Enrich with dummy data for now
    return bookings.map((b: any) => ({ ...b, delegateName: 'John Doe', hotelName: 'Hotel X', roomTypeName: 'Suite', roomNumber: b.roomNumber || 'Pending' }));
};
export const updateBookingStatus = async (token: string, id: string, status: AccommodationBookingStatus) => await db.update('bookings', id, { status });
export const assignRoomToBooking = async (token: string, bookingId: string, roomId: string) => {
    const room = await db.find('rooms', (r: any) => r.id === roomId);
    if (room) {
        await db.update('bookings', bookingId, { hotelRoomId: roomId, roomNumber: room.roomNumber, status: 'CheckedIn' });
        await db.update('rooms', roomId, { status: 'Occupied' });
    }
};
export const processCheckOut = async (token: string, bookingId: string) => {
    const booking = await db.find('bookings', (b: any) => b.id === bookingId);
    if (booking && booking.hotelRoomId) {
        await db.update('bookings', bookingId, { status: 'CheckedOut' });
        await db.update('rooms', booking.hotelRoomId, { status: 'Cleaning' });
    }
};

export const getAllRooms = async (token: string, hotelId: string): Promise<HotelRoom[]> => await db.findAll('rooms', (r: any) => r.hotelId === hotelId);
export const getAvailableRooms = async (token: string, hotelId: string, roomTypeId: string): Promise<HotelRoom[]> => {
    return await db.findAll('rooms', (r: any) => r.hotelId === hotelId && r.roomTypeId === roomTypeId && r.status === 'Available');
};
export const generateHotelRooms = async (token: string, hotelId: string, roomTypeId: string, count: number, startNumber: number) => {
    for (let i = 0; i < count; i++) {
        await db.insert('rooms', { 
            id: `room_${Date.now()}_${i}`, 
            hotelId, 
            roomTypeId, 
            roomNumber: (startNumber + i).toString(), 
            status: 'Available' 
        });
    }
};
export const updateRoomStatus = async (token: string, id: string, status: HotelRoomStatus) => await db.update('rooms', id, { status });

export const recordMealConsumption = async (token: string, delegateId: string, mealType: MealType) => ({ success: true, message: 'Meal recorded' });
export const assignMealPlan = async (token: string, planId: string, start: string, end: string) => {};
export const bookAccommodation = async (token: string, hotelId: string, roomTypeId: string, checkIn: string, checkOut: string) => {
    await db.insert('bookings', { id: `bk_${Date.now()}`, hotelId, roomTypeId, checkInDate: checkIn, checkOutDate: checkOut, status: 'Confirmed' });
};
export const makeDiningReservation = async (token: string, restaurantId: string, time: string, size: number) => {};
export const getReservationsForRestaurant = async (token: string, id: string): Promise<DiningReservation[]> => [];
export const createAdminDiningReservation = async (token: string, data: any) => {};
export const deleteDiningReservation = async (token: string, id: string) => {};

// --- TASKS ---

export const getTasks = async (token: string, eventId: string): Promise<Task[]> => await db.findAll('tasks');
export const saveTask = async (token: string, task: any) => {
    if (task.id) await db.update('tasks', task.id, task);
    else await db.insert('tasks', { ...task, id: `task_${Date.now()}`, createdAt: Date.now() });
};
export const deleteTask = async (token: string, id: string) => await db.remove('tasks', id);

// --- WALLET & ECONOMY ---

export const getEventCoinStats = async (token: string): Promise<EventCoinStats> => ({ totalCirculation: 50000, totalTransactions: 1200, activeWallets: 150 });
export const getAllTransactions = async (token: string): Promise<Transaction[]> => await db.findAll('transactions');
export const getDelegateBalance = async (token: string) => ({ balance: 150, currencyName: 'EventCoin' });
export const getDelegateTransactions = async (token: string): Promise<Transaction[]> => [];
export const sendCoins = async (token: string, toEmail: string, amount: number, message: string) => {};
export const issueEventCoins = async (token: string, email: string, amount: number, message: string) => {
    await db.insert('transactions', { id: `tx_${Date.now()}`, amount, message, timestamp: Date.now(), type: 'admin_adjustment', fromName: 'Admin', toEmail: email });
};
export const createPaymentIntent = async (token: string, amount: number) => ({ clientSecret: 'mock_secret' });
export const purchaseEventCoins = async (token: string, coins: number, cost: number) => {};

// --- COMMUNICATION ---

export const sendDelegateInvitation = async (token: string, eventId: string, email: string) => {};
export const sendUpdateEmailToDelegate = async (token: string, eventId: string, delegateId: string) => {};
export const sendTestEmail = async (token: string, to: string, config: EventConfig) => {};
export const sendBroadcast = async (token: string, subject: string, body: string, target: string, channel: string) => ({ success: true, message: 'Broadcast queued' });
export const getEmailLogs = async (token: string) => await db.findAll('email_logs');
export const getNotifications = async (token: string): Promise<AppNotification[]> => [];
export const markNotificationRead = async (token: string, id: string) => {};
export const clearAllNotifications = async (token: string) => {};

export const getConversations = async (token: string): Promise<ChatConversation[]> => [];
export const getMessages = async (token: string, otherId: string): Promise<ChatMessage[]> => [];
export const sendMessage = async (token: string, receiverId: string, content: string) => {};

// --- MEDIA ---

export const getMediaLibrary = async (token: string): Promise<MediaItem[]> => await db.findAll('media');
export const uploadFile = async (file: File) => await uploadFileToStorage(file);
export const deleteMedia = async (token: string, id: string) => await db.remove('media', id);

// --- AI ---

export const generateImage = async (prompt: string) => {
    const base64 = await geminiGenerateImage(prompt);
    return await saveGeneratedImageToStorage(base64);
};
export const generateAiContent = async (type: string, context: any) => {
    return await geminiGenerateContent(type as any, context);
};
export const getEventContextForAI = async (token: string) => "You are a helpful assistant for Tech Summit 2025.";

// --- GAMIFICATION ---

export const getScavengerHuntItems = async (token: string): Promise<ScavengerHuntItem[]> => await db.findAll('scavenger_hunt_items');
export const saveScavengerHuntItem = async (token: string, item: any) => {
    if (item.id) await db.update('scavenger_hunt_items', item.id, item);
    else await db.insert('scavenger_hunt_items', { ...item, id: `hunt_${Date.now()}` });
};
export const deleteScavengerHuntItem = async (token: string, id: string) => await db.remove('scavenger_hunt_items', id);
export const getScavengerHuntLeaderboard = async (token: string): Promise<LeaderboardEntry[]> => [];
export const getScavengerHuntProgress = async (token: string): Promise<string[]> => []; // Returns list of completed item IDs
export const claimScavengerHuntItem = async (token: string, code: string) => ({ success: true, message: 'Found!' });

// --- NETWORKING ---

export const getMyNetworkingProfile = async (token: string): Promise<NetworkingProfile | null> => null;
export const updateNetworkingProfile = async (token: string, data: Partial<NetworkingProfile>) => {};
export const getNetworkingCandidates = async (token: string): Promise<{ matches: NetworkingMatch[], allCandidates: NetworkingProfile[] }> => ({ matches: [], allCandidates: [] });

// --- TICKETING ---

export const getTicketTiers = async (token: string): Promise<TicketTier[]> => await db.findAll('ticket_tiers');
export const saveTicketTier = async (token: string, tier: any) => {
    if (tier.id) await db.update('ticket_tiers', tier.id, tier);
    else await db.insert('ticket_tiers', { ...tier, id: `tier_${Date.now()}` });
};
export const deleteTicketTier = async (token: string, id: string) => await db.remove('ticket_tiers', id);

// --- VENUE MAPS ---

export const getVenueMaps = async (token: string): Promise<VenueMap[]> => await db.findAll('venueMaps');
export const saveVenueMap = async (token: string, map: any) => {
    if (map.id) await db.update('venueMaps', map.id, map);
    else await db.insert('venueMaps', { ...map, id: `map_${Date.now()}` });
};
export const deleteVenueMap = async (token: string, id: string) => await db.remove('venueMaps', id);
