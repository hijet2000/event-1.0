
import { 
    RegistrationData, PublicEvent, EventConfig, Permission, Session, Speaker, Sponsor, TicketTier, Task, MealPlan, Restaurant, EnrichedAccommodationBooking, Hotel, HotelRoom, DiningReservation, AppNotification, SessionQuestion, PollWithResults, ChatConversation, ChatMessage, MediaItem, VenueMap, SocialPost, EmailContent
} from '../types';

// Fallback logic for when PHP backend is offline
import { db, saveDb, initializeDb } from './store';
import { generateToken, comparePassword } from './auth';

export let IS_ONLINE = false;
const PHP_ROOT = '/api';

/**
 * Initializes the API by checking backend health.
 * If the server is unreachable, it switches to Sandbox (Mock) mode.
 */
export const initializeApi = async (forceOnline = true): Promise<boolean> => {
    // Ensure local store is ready immediately before any network calls
    await initializeDb();
    
    try {
        // Use a short timeout for health check to avoid long hangs
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(`${PHP_ROOT}/health.php`, { signal: controller.signal })
            .catch(() => ({ ok: false }));
        
        clearTimeout(timeoutId);
        IS_ONLINE = (res as any).ok || false;
    } catch (e) {
        IS_ONLINE = false;
    }
    
    console.log(`API initialized in ${IS_ONLINE ? 'ONLINE' : 'SANDBOX'} mode.`);
    return IS_ONLINE;
};

export const isBackendConnected = () => IS_ONLINE;
export const setForceOffline = () => { IS_ONLINE = false; };

/**
 * Helper to communicate with PHP backend
 */
const phpFetch = async (endpoint: string, options: any = {}) => {
    const adminToken = localStorage.getItem('adminToken');
    const delegateToken = localStorage.getItem('delegateToken');
    const token = adminToken || delegateToken;

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    // Add a reasonable timeout to all API calls
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(`${PHP_ROOT}/${endpoint}`, { 
            ...options, 
            headers,
            signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: 'Server Error' }));
            throw new Error(err.message || `API Call Failed with status ${response.status}`);
        }
        return response.json();
    } catch (e) {
        clearTimeout(timeoutId);
        if ((e as any).name === 'AbortError') {
            throw new Error("Request timed out. Please check your internet connection.");
        }
        throw e;
    }
};

// --- Authentication ---

export const loginAdmin = async (email: string, password_input: string) => {
    // Ensure DB is definitely ready for local mode
    if (!db.admin_users || db.admin_users.length === 0) {
        await initializeDb();
    }

    if (!IS_ONLINE) {
        // Fallback to local mock database
        const user = db.admin_users.find((u: any) => u.email === email);
        if (user && await comparePassword(password_input, user.password_hash)) {
            const role = db.roles.find((r: any) => r.id === user.roleId);
            const token = generateToken({
                id: user.id,
                email: user.email,
                type: 'admin',
                permissions: role ? role.permissions : []
            });
            return { token, user: { ...user, permissions: role ? role.permissions : [] } };
        }
        return null;
    }

    return phpFetch('login.php', {
        method: 'POST',
        body: JSON.stringify({ email, password: password_input, type: 'admin' })
    });
};

export const loginDelegate = async (eventId: string, email: string, password_input: string) => {
    if (!IS_ONLINE) {
        const user = db.registrations.find((r: any) => r.email === email && r.eventId === eventId);
        if (user) {
             const token = generateToken({
                id: user.id,
                email: user.email,
                type: 'delegate',
                eventId
            });
            return { token, user };
        }
        return null;
    }

    return phpFetch('login.php', {
        method: 'POST',
        body: JSON.stringify({ eventId, email, password: password_input, type: 'delegate' })
    });
};

// --- Events ---

export const getPublicEventData = async (eventId: string) => {
    if (!IS_ONLINE) {
        const event = db.events.find((e: any) => e.id === eventId);
        if (!event) throw new Error("Event not found in Sandbox");
        return {
            config: event.config,
            registrationCount: db.registrations.filter((r: any) => r.eventId === eventId).length,
            sessions: db.sessions.filter((s: any) => s.eventId === eventId),
            speakers: db.speakers,
            sponsors: db.sponsors,
            ticketTiers: db.ticket_tiers.filter((t: any) => t.eventId === eventId)
        };
    }
    return phpFetch(`event_data.php?eventId=${eventId}`);
};

export const listPublicEvents = async (): Promise<PublicEvent[]> => {
    if (!IS_ONLINE) return db.events;
    return phpFetch('list_events.php').catch(() => db.events);
};

// --- Registration ---

export const registerUser = async (eventId: string, data: any, inviteToken?: string) => {
    if (!IS_ONLINE) {
        const existing = db.registrations.find((r: any) => r.email === data.email && r.eventId === eventId);
        if (existing) return { success: false, message: 'Email already registered.' };
        
        const newUser = {
            ...data,
            id: `reg_${Date.now()}`,
            eventId,
            createdAt: Date.now(),
            status: 'confirmed'
        };
        db.registrations.push(newUser);
        saveDb();
        return { success: true, user: newUser };
    }

    try {
        const res = await phpFetch(`register.php`, {
            method: 'POST',
            body: JSON.stringify({ eventId, ...data, inviteToken })
        });
        return { success: true, user: res.user };
    } catch (e) {
        return { success: false, message: (e as Error).message };
    }
};

// --- Dashboard & Stats ---
export const getDashboardStats = async (token: string) => {
    if (!IS_ONLINE) {
        return {
            totalRegistrations: db.registrations.length,
            maxAttendees: 500,
            eventDate: "October 26, 2025",
            registrationTrend: [],
            taskStats: { total: db.tasks.length, completed: db.tasks.filter((t:any)=>t.status==='completed').length, pending: db.tasks.filter((t:any)=>t.status!=='completed').length },
            recentRegistrations: db.registrations.slice(-5).reverse(),
            eventCoinName: "EventCoin",
            eventCoinCirculation: 1000,
            activeWallets: 10,
            totalTransactions: db.transactions.length
        };
    }
    return phpFetch('dashboard.php');
};

// --- Common Placeholders & Remaining Exports ---
export const getRegistrations = async (token: string) => IS_ONLINE ? phpFetch('registrations.php') : db.registrations;
export const getEventConfig = async (eventId: string = 'main-event') => getPublicEventData(eventId).then(r => r.config);
export const requestAdminPasswordReset = async (email: string) => IS_ONLINE ? phpFetch('reset_request.php', { method: 'POST', body: JSON.stringify({ email }) }) : true;
export const requestDelegatePasswordReset = async (eventId: string, email: string) => IS_ONLINE ? phpFetch('reset_request.php', { method: 'POST', body: JSON.stringify({ eventId, email }) }) : true;
export const resetPassword = async (token: string, password_input: string) => IS_ONLINE ? phpFetch('reset_password.php', { method: 'POST', body: JSON.stringify({ token, password: password_input }) }) : true;
export const createEvent = async (token: string, name: string, eventType: string) => IS_ONLINE ? phpFetch('create_event.php', { method: 'POST', body: JSON.stringify({ name, eventType }) }) : { id: 'new', name };
export const saveConfig = async (token: string, config: EventConfig) => IS_ONLINE ? phpFetch('save_config.php', { method: 'POST', body: JSON.stringify(config) }) : true;
export const syncConfigFromGitHub = async (token: string) => IS_ONLINE ? phpFetch('github_sync.php') : {};
export const pushConfigToGitHub = async (token: string) => IS_ONLINE ? phpFetch('github_push.php') : {};
export const updateRegistrationStatus = async (token: string, id: string, status: string) => true;
export const deleteAdminRegistration = async (token: string, id: string) => true;
export const verifyTicketToken = async (token: string, ticketToken: string): Promise<{ success: boolean; user: any; message: string }> => ({ success: true, user: {}, message: 'Verified' });
export const promoteToConfirmed = async (token: string, id: string) => true;
export const saveAdminRegistration = async (token: string, id: string, data: any) => true;
export const bulkImportRegistrations = async (token: string, csv: string) => ({ successCount: 0, errorCount: 0, errors: [] });
export const sendDelegateInvitation = async (token: string, eventId: string, email: string) => true;
export const sendUpdateEmailToDelegate = async (token: string, eventId: string, id: string) => true;
export const cancelRegistration = async (token: string, id: string) => true;
export const getEventCoinStats = async (token: string) => ({ totalCirculation: 0, totalTransactions: 0, activeWallets: 0 });
export const getAllTransactions = async (token: string) => [];
export const issueEventCoins = async (token: string, email: string, amount: number, message: string) => true;
export const getDelegateBalance = async (token: string) => ({ balance: 100, currencyName: 'EventCoin' });
export const getDelegateTransactions = async (token: string) => [];
export const sendCoins = async (token: string, email: string, amount: number, msg: string) => true;
export const purchaseEventCoins = async (token: string, coins: number, amount: number) => true;
export const getAdminUsers = async (token: string) => db.admin_users;
export const getRoles = async (token: string) => db.roles;
export const saveAdminUser = async (token: string, data: any) => true;
export const deleteAdminUser = async (token: string, id: string) => true;
export const saveRole = async (token: string, data: any) => true;
export const deleteRole = async (token: string, id: string) => true;
export const getTasks = async (token: string, eventId: string) => db.tasks;
export const saveTask = async (token: string, data: any) => true;
export const deleteTask = async (token: string, id: string) => true;
export const getMealPlans = async (token: string) => db.meal_plans;
export const getRestaurants = async (token: string) => db.restaurants;
export const saveMealPlan = async (token: string, data: any) => true;
export const deleteMealPlan = async (token: string, id: string) => true;
export const saveRestaurant = async (token: string, data: any) => true;
export const deleteRestaurant = async (token: string, id: string) => true;
export const recordMealConsumption = async (token: string, delegateId: string, mealType: string) => ({ success: true, message: 'Meal recorded' });
export const assignMealPlan = async (token: string, planId: string, start: string, end: string) => true;
export const makeDiningReservation = async (token: string, restId: string, time: string, size: number) => true;
export const getReservationsForRestaurant = async (token: string, id: string) => [];
export const createAdminDiningReservation = async (token: string, data: any) => true;
export const deleteDiningReservation = async (token: string, id: string) => true;
export const getAccommodationBookings = async (token: string) => [];
export const updateBookingStatus = async (token: string, id: string, status: string) => true;
export const getHotels = async (token: string) => db.hotels;
export const saveHotel = async (token: string, data: any) => true;
export const deleteHotel = async (token: string, id: string) => true;
export const generateHotelRooms = async (token: string, hId: string, rId: string, c: number, s: number) => true;
export const getAvailableRooms = async (token: string, hId: string, rId: string) => [];
export const assignRoomToBooking = async (token: string, bId: string, rId: string) => true;
export const getAllRooms = async (token: string, hId: string) => [];
export const updateRoomStatus = async (token: string, id: string, status: string) => true;
export const processCheckOut = async (token: string, id: string) => true;
export const createAdminAccommodationBooking = async (token: string, dId: string, hId: string, rId: string, inD: string, outD: string) => true;
export const bookAccommodation = async (token: string, hId: string, rId: string, inD: string, outD: string) => true;
export const cancelAccommodationBooking = async (token: string, id: string) => true;
export const selfCheckOut = async (token: string, id: string) => true;
export const getSessions = async (token: string) => db.sessions;
export const saveSession = async (token: string, data: any) => true;
export const deleteSession = async (token: string, id: string) => true;
export const getSpeakers = async (token: string) => db.speakers;
export const saveSpeaker = async (token: string, data: any) => true;
export const deleteSpeaker = async (token: string, id: string) => true;
export const getSessionFeedbackStats = async (token: string, id: string) => ({ count: 0, avgRating: 0 });
export const analyzeFeedback = async (token: string, id: string) => "N/A";
export const addToAgenda = async (token: string, id: string) => true;
export const removeFromAgenda = async (token: string, id: string) => true;
export const getMyAgenda = async (token: string) => [];
export const submitSessionFeedback = async (token: string, id: string, r: number, c: string) => true;
export const downloadSessionIcs = async (session: Session) => {};
export const getActiveSessions = async () => [];
export const getPublicSessionData = async (id: string): Promise<{ session: Session; polls: PollWithResults[]; questions: SessionQuestion[]; }> => ({
    session: {} as Session,
    polls: [],
    questions: []
});
export const getSponsors = async (token: string) => db.sponsors;
export const saveSponsor = async (token: string, data: any) => true;
export const deleteSponsor = async (token: string, id: string) => true;
export const generateAiContent = async (type: string, context: any) => "";
export const researchEntity = async (token: string, type: string, name: string): Promise<any> => ({});
export const generateImage = async (prompt: string) => "";
export const generateMarketingVideo = async (prompt: string, img?: string) => "";
export const getEventContextForAI = async (token: string) => "";
export const askHelp = async (token: string, query: string) => "Try checking the documentation.";
export const translateText = async (text: string, lang: string) => text;
export const getEmailLogs = async (token: string) => [];
export const sendBroadcast = async (token: string, s: string, b: string, t: string, c: string) => ({ success: true, message: 'Broadcast queued' });
export const getMediaLibrary = async (token: string) => db.media;
export const uploadFile = async (file: File) => ({ id: '1', url: '' });
export const deleteMedia = async (token: string, id: string) => true;
export const getMyNetworkingProfile = async (token: string) => null;
export const updateNetworkingProfile = async (token: string, data: any) => ({});
export const getNetworkingCandidates = async (token: string) => ({ matches: [], allCandidates: [] });
export const updateDelegateProfile = async (token: string, data: any) => ({});
export const getDelegateProfile = async (token: string) => ({ user: {} });
export const getScavengerHuntItems = async (token: string) => [];
export const saveScavengerHuntItem = async (token: string, data: any) => true;
export const deleteScavengerHuntItem = async (token: string, id: string) => true;
export const getScavengerHuntLeaderboard = async (token: string) => [];
export const getScavengerHuntProgress = async (token: string) => [];
export const claimScavengerHuntItem = async (token: string, code: string) => ({ success: true, message: 'Claimed' });
export const getConversations = async (token: string) => [];
export const getMessages = async (token: string, id: string) => [];
export const sendMessage = async (token: string, rId: string, c: string) => true;
export const sendSignal = async (token: string, to: string, t: string, d: any) => {};
export const subscribeToSignals = (cb: any) => () => {};
export const getNotifications = async (token: string) => [];
export const markNotificationRead = async (token: string, id: string) => true;
export const clearAllNotifications = async (token: string) => true;
export const getSessionQuestions = async (token: string, id: string) => [];
export const submitSessionQuestion = async (token: string, id: string, t: string) => true;
export const upvoteSessionQuestion = async (token: string, id: string) => true;
export const getPolls = async (token: string, id: string) => [];
export const createPoll = async (token: string, id: string, q: string, o: string[]) => true;
export const updatePollStatus = async (token: string, id: string, s: string) => true;
export const votePoll = async (token: string, id: string, idx: number) => true;
export const getTicketTiers = async (token: string) => [];
export const saveTicketTier = async (token: string, data: any) => true;
export const deleteTicketTier = async (token: string, id: string) => true;
export const getVenueMaps = async (token: string) => [];
export const saveVenueMap = async (token: string, data: any) => true;
export const deleteVenueMap = async (token: string, id: string) => true;
export const getSocialPosts = async (token: string) => [];
export const createSocialPost = async (token: string, data: any) => true;
export const getSystemApiKey = async (token: string) => "";
export const getDatabaseSchema = async (token: string) => "";
export const generateSqlExport = async (token: string) => "";
export const seedDemoData = async (token: string) => ({});
export const getSignedTicketToken = async (token: string) => "";
export const recordTicketSale = async (eId: string, tId: string, a: number) => true;
export const getInvitationDetails = async (token: string) => null;
export const processCheckIn = async (token: string, id: string, eId: string): Promise<{ success: boolean; user: any; message: string }> => ({ success: true, user: {}, message: '' });
export const createPaymentIntent = async (token: string, a: number) => ({ clientSecret: "" });
export const createPublicPaymentIntent = async (a: number) => ({ clientSecret: "" });
export const sendTestEmail = async (token: string, to: string, cfg: any) => true;
