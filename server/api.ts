
import { 
    RegistrationData, PublicEvent, EventConfig, Permission, Session, Speaker, Sponsor, TicketTier, Task, MealPlan, Restaurant, EnrichedAccommodationBooking, Hotel, HotelRoom, DiningReservation, AppNotification, SessionQuestion, PollWithResults, ChatConversation, ChatMessage, MediaItem, VenueMap, SocialPost, EmailContent
} from '../types';

const API_ROOT = '/api';

/**
 * Helper to communicate with the Node.js backend
 */
const apiFetch = async (endpoint: string, options: any = {}) => {
    const adminToken = localStorage.getItem('adminToken');
    const delegateToken = localStorage.getItem('delegateToken');
    const token = adminToken || delegateToken;

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_ROOT}/${endpoint}`, options.headers ? { ...options, headers: { ...headers, ...options.headers } } : { ...options, headers });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Server Error' }));
        throw new Error(err.error || `API Call Failed with status ${response.status}`);
    }
    return response.json();
};

// --- Authentication ---

export const loginAdmin = async (email: string, password_input: string) => {
    return apiFetch('auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: password_input })
    });
};

export const loginDelegate = async (eventId: string, email: string, password_input: string) => {
    return apiFetch('auth/delegate/login', {
        method: 'POST',
        body: JSON.stringify({ eventId, email, password: password_input })
    });
};

// --- Events ---

export const getPublicEventData = async (eventId: string) => {
    return apiFetch(`public/event/${eventId}`);
};

export const listPublicEvents = async (): Promise<PublicEvent[]> => {
    return apiFetch('public/events');
};

// --- Registration ---

export const registerUser = async (eventId: string, data: any, inviteToken?: string) => {
    try {
        const res = await apiFetch(`register`, {
            method: 'POST',
            body: JSON.stringify({ eventId, ...data, inviteToken })
        });
        return { success: true, user: res.user };
    } catch (e) {
        return { success: false, message: (e as Error).message };
    }
};

// Fix: Added cancelRegistration export
export const cancelRegistration = async (token: string, id: string) => {
    return apiFetch(`registrations/${id}/cancel`, { method: 'POST' });
};

// --- Dashboard & Stats ---
export const getDashboardStats = async (token: string) => {
    return apiFetch('admin/stats');
};

// Fix: Added getEventCoinStats export
export const getEventCoinStats = async (token: string) => {
    return apiFetch('economy/stats');
};

// --- CRUD Operations (Production Routes) ---

// Fix: Added getAdminUsers and getRoles exports
export const getAdminUsers = async (token: string) => apiFetch('data/admin_users');
export const getRoles = async (token: string) => apiFetch('data/roles');

// Fix: Added saveAdminUser and deleteAdminUser exports
export const saveAdminUser = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/admin_users/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/admin_users', { method: 'POST', body: JSON.stringify(data) });
};
export const deleteAdminUser = async (token: string, id: string) => apiFetch(`data/admin_users/${id}`, { method: 'DELETE' });

// Fix: Added saveRole and deleteRole exports
export const saveRole = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/roles/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/roles', { method: 'POST', body: JSON.stringify(data) });
};
export const deleteRole = async (token: string, id: string) => apiFetch(`data/roles/${id}`, { method: 'DELETE' });

export const getRegistrations = async (token: string) => apiFetch('data/registrations');
export const getEventConfig = async (eventId: string = 'main-event') => apiFetch(`data/events/${eventId}`).then(r => r.config);
export const saveConfig = async (token: string, config: EventConfig) => apiFetch(`data/events/main-event`, { method: 'PUT', body: JSON.stringify({ config }) });

export const updateRegistrationStatus = async (token: string, id: string, checkedIn: boolean) => {
    return apiFetch(`data/registrations/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ checkedIn })
    });
};

export const deleteAdminRegistration = async (token: string, id: string) => apiFetch(`data/registrations/${id}`, { method: 'DELETE' });
export const saveAdminRegistration = async (token: string, id: string, data: any) => apiFetch(`data/registrations/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const getSessions = async (token: string) => apiFetch('data/sessions');
export const saveSession = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/sessions/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/sessions', { method: 'POST', body: JSON.stringify({ ...data, id: `sess_${Date.now()}` }) });
};
export const deleteSession = async (token: string, id: string) => apiFetch(`data/sessions/${id}`, { method: 'DELETE' });

export const getSpeakers = async (token: string) => apiFetch('data/speakers');
export const saveSpeaker = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/speakers/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/speakers', { method: 'POST', body: JSON.stringify(data) });
};
export const deleteSpeaker = async (token: string, id: string) => apiFetch(`data/speakers/${id}`, { method: 'DELETE' });

export const getSponsors = async (token: string) => apiFetch('data/sponsors');
export const saveSponsor = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/sponsors/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/sponsors', { method: 'POST', body: JSON.stringify(data) });
};
export const deleteSponsor = async (token: string, id: string) => apiFetch(`data/sponsors/${id}`, { method: 'DELETE' });

export const getTasks = async (token: string, eventId: string) => apiFetch('data/tasks');
export const saveTask = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/tasks/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/tasks', { method: 'POST', body: JSON.stringify({ ...data, id: `task_${Date.now()}`, createdAt: Date.now() }) });
};
export const deleteTask = async (token: string, id: string) => apiFetch(`data/tasks/${id}`, { method: 'DELETE' });

export const getMealPlans = async (token: string) => apiFetch('data/meal_plans');
export const saveMealPlan = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/meal_plans/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/meal_plans', { method: 'POST', body: JSON.stringify(data) });
};
export const deleteMealPlan = async (token: string, id: string) => apiFetch(`data/meal_plans/${id}`, { method: 'DELETE' });

export const getRestaurants = async (token: string) => apiFetch('data/restaurants');
export const saveRestaurant = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/restaurants/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/restaurants', { method: 'POST', body: JSON.stringify(data) });
};
export const deleteRestaurant = async (token: string, id: string) => apiFetch(`data/restaurants/${id}`, { method: 'DELETE' });

export const getHotels = async (token: string) => apiFetch('data/hotels');
export const saveHotel = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/hotels/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/hotels', { method: 'POST', body: JSON.stringify(data) });
};
export const deleteHotel = async (token: string, id: string) => apiFetch(`data/hotels/${id}`, { method: 'DELETE' });

export const getAccommodationBookings = async (token: string) => apiFetch('data/bookings');

export const getTicketTiers = async (token: string) => apiFetch('data/ticket_tiers');
export const saveTicketTier = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/ticket_tiers/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/ticket_tiers', { method: 'POST', body: JSON.stringify(data) });
};
export const deleteTicketTier = async (token: string, id: string) => apiFetch(`data/ticket_tiers/${id}`, { method: 'DELETE' });

export const getVenueMaps = async (token: string) => apiFetch('data/venue_maps');
export const saveVenueMap = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/venue_maps/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/venue_maps', { method: 'POST', body: JSON.stringify(data) });
};
export const deleteVenueMap = async (token: string, id: string) => apiFetch(`data/venue_maps/${id}`, { method: 'DELETE' });

export const getMediaLibrary = async (token: string) => apiFetch('data/media');
export const deleteMedia = async (token: string, id: string) => apiFetch(`data/media/${id}`, { method: 'DELETE' });

export const getEmailLogs = async (token: string) => apiFetch('data/email_logs');

// --- Economy ---

export const getAllTransactions = async (token: string) => apiFetch('data/transactions');
export const issueEventCoins = async (token: string, email: string, amount: number, message: string) => apiFetch('economy/issue', { method: 'POST', body: JSON.stringify({ email, amount, message }) });
export const getDelegateBalance = async (token: string) => apiFetch('economy/balance');
export const getDelegateTransactions = async (token: string) => apiFetch('economy/transactions');
export const sendCoins = async (token: string, email: string, amount: number, message: string) => apiFetch('economy/transfer', { method: 'POST', body: JSON.stringify({ email, amount, message }) });
export const purchaseEventCoins = async (token: string, coins: number, amount: number) => apiFetch('economy/purchase', { method: 'POST', body: JSON.stringify({ coins, amount }) });

// --- Specialized AI / Tools ---

export const generateMarketingVideo = async (prompt: string, img?: string) => apiFetch('marketing/generate-video', { method: 'POST', body: JSON.stringify({ prompt, img }) }).then(r => r.url);
export const researchEntity = async (token: string, type: string, name: string) => apiFetch('ai/research', { method: 'POST', body: JSON.stringify({ type, name }) });
export const askHelp = async (token: string, query: string) => apiFetch('ai/help', { method: 'POST', body: JSON.stringify({ query }) }).then(r => r.answer);
export const generateAiContent = async (type: string, context: any) => apiFetch('ai/generate', { method: 'POST', body: JSON.stringify({ type, context }) }).then(r => r.content);

// --- Rest of Placeholders ---

// Fix: initializeApi now accepts optional force argument
export const initializeApi = async (force: boolean = false) => true; 
export const isBackendConnected = () => true;
export const setForceOffline = () => {};
export const requestAdminPasswordReset = async (email: string) => apiFetch('auth/reset-request', { method: 'POST', body: JSON.stringify({ email, type: 'admin' }) });
export const requestDelegatePasswordReset = async (eventId: string, email: string) => apiFetch('auth/reset-request', { method: 'POST', body: JSON.stringify({ eventId, email, type: 'delegate' }) });
export const resetPassword = async (token: string, password: string) => apiFetch('auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
export const createEvent = async (token: string, name: string, eventType: string) => apiFetch('data/events', { method: 'POST', body: JSON.stringify({ id: `event_${Date.now()}`, name, config: {}, created_at: Date.now() }) });
export const recordTicketSale = async (eventId: string, tierId: string, amount: number) => apiFetch('ticketing/sale', { method: 'POST', body: JSON.stringify({ eventId, tierId, amount }) });
export const sendBroadcast = async (token: string, subject: string, body: string, target: string, channel: string) => apiFetch('communications/broadcast', { method: 'POST', body: JSON.stringify({ subject, body, target, channel }) });
export const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('upload', { method: 'POST', body: formData, headers: { 'Content-Type': undefined } });
};
export const getDelegateProfile = async (token: string) => apiFetch('delegate/profile');
export const updateDelegateProfile = async (token: string, data: any) => apiFetch('delegate/profile', { method: 'PUT', body: JSON.stringify(data) });
export const getMyAgenda = async (token: string) => apiFetch('delegate/agenda');
export const addToAgenda = async (token: string, id: string) => apiFetch(`delegate/agenda/${id}`, { method: 'POST' });
export const removeFromAgenda = async (token: string, id: string) => apiFetch(`delegate/agenda/${id}`, { method: 'DELETE' });
export const submitSessionFeedback = async (token: string, id: string, rating: number, comment: string) => apiFetch(`sessions/${id}/feedback`, { method: 'POST', body: JSON.stringify({ rating, comment }) });
export const processCheckIn = async (token: string, id: string, eventId: string) => apiFetch('admin/check-in', { method: 'POST', body: JSON.stringify({ identifier: id, eventId }) });
export const verifyTicketToken = async (token: string, ticketToken: string) => apiFetch('admin/verify-ticket', { method: 'POST', body: JSON.stringify({ ticketToken }) });
export const promoteToConfirmed = async (token: string, id: string) => apiFetch(`data/registrations/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'confirmed' }) });
export const getSignedTicketToken = async (token: string) => apiFetch('delegate/ticket-token');
export const createPaymentIntent = async (token: string, amount: number) => apiFetch('payment/intent', { method: 'POST', body: JSON.stringify({ amount }) });
export const createPublicPaymentIntent = async (amount: number) => apiFetch('payment/intent/public', { method: 'POST', body: JSON.stringify({ amount }) });
export const sendTestEmail = async (token: string, to: string, cfg: any) => apiFetch('communications/test-email', { method: 'POST', body: JSON.stringify({ to, config: cfg }) });
export const getSystemApiKey = async (token: string) => 'sk-placeholder';
export const getDatabaseSchema = async (token: string) => apiFetch('admin/schema');
export const generateSqlExport = async (token: string) => apiFetch('admin/export');
export const seedDemoData = async (token: string) => apiFetch('admin/seed', { method: 'POST' });
export const getPublicSessionData = async (id: string) => apiFetch(`public/session/${id}`);
export const getActiveSessions = async () => apiFetch('public/active-sessions');
export const translateText = async (text: string, targetLanguage: string) => apiFetch('ai/translate', { method: 'POST', body: JSON.stringify({ text, targetLanguage }) }).then(r => r.translatedText);
export const getEventContextForAI = async (token: string) => apiFetch('ai/context');
export const getInvitationDetails = async (token: string) => apiFetch(`public/invitation/${token}`);
export const bulkImportRegistrations = async (token: string, csv: string) => apiFetch('admin/import', { method: 'POST', body: JSON.stringify({ csv }) });
export const getSessionFeedbackStats = async (token: string, id: string) => apiFetch(`sessions/${id}/feedback-stats`);
export const analyzeFeedback = async (token: string, id: string) => apiFetch(`sessions/${id}/analyze-feedback`, { method: 'POST' }).then(r => r.summary);
export const updatePollStatus = async (token: string, id: string, status: string) => apiFetch(`polls/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
export const votePoll = async (token: string, id: string, index: number) => apiFetch(`polls/${id}/vote`, { method: 'POST', body: JSON.stringify({ index }) });
export const createPoll = async (token: string, sessionId: string, question: string, options: string[]) => apiFetch('data/polls', { method: 'POST', body: JSON.stringify({ id: `poll_${Date.now()}`, sessionId, question, options, status: 'draft', createdAt: Date.now() }) });
export const getPolls = async (token: string, sessionId: string) => apiFetch(`sessions/${sessionId}/polls`);
export const getSessionQuestions = async (token: string, sessionId: string) => apiFetch(`sessions/${sessionId}/questions`);
export const submitSessionQuestion = async (token: string, sessionId: string, text: string) => apiFetch(`sessions/${sessionId}/questions`, { method: 'POST', body: JSON.stringify({ text }) });
export const upvoteSessionQuestion = async (token: string, id: string) => apiFetch(`questions/${id}/upvote`, { method: 'POST' });
export const getConversations = async (token: string) => apiFetch('messaging/conversations');
export const getMessages = async (token: string, partnerId: string) => apiFetch(`messaging/messages/${partnerId}`);
export const sendMessage = async (token: string, recipientId: string, content: string) => apiFetch('messaging/send', { method: 'POST', body: JSON.stringify({ recipientId, content }) });
export const getNotifications = async (token: string) => apiFetch('notifications');
export const markNotificationRead = async (token: string, id: string) => apiFetch(`notifications/${id}/read`, { method: 'POST' });
export const clearAllNotifications = async (token: string) => apiFetch('notifications/clear', { method: 'POST' });
export const getScavengerHuntItems = async (token: string) => apiFetch('data/scavenger_hunt_items');
export const getScavengerHuntProgress = async (token: string) => apiFetch('gamification/progress');
export const getScavengerHuntLeaderboard = async (token: string) => apiFetch('gamification/leaderboard');
export const claimScavengerHuntItem = async (token: string, code: string) => apiFetch('gamification/claim', { method: 'POST', body: JSON.stringify({ code }) });
export const getMyNetworkingProfile = async (token: string) => apiFetch('networking/profile');
export const updateNetworkingProfile = async (token: string, data: any) => apiFetch('networking/profile', { method: 'PUT', body: JSON.stringify(data) });
export const getNetworkingCandidates = async (token: string) => apiFetch('networking/matches');
export const createSocialPost = async (token: string, data: any) => apiFetch('data/social_posts', { method: 'POST', body: JSON.stringify({ ...data, id: `post_${Date.now()}`, timestamp: Date.now() }) });
export const getSocialPosts = async (token: string) => apiFetch('data/social_posts');
export const sendSignal = async (token: string, to: string, type: string, data: any) => {}; // Real-time calls need socket.io integration
export const subscribeToSignals = (cb: any) => () => {};
export const downloadSessionIcs = async (session: Session) => {};

// Fix: Added missing specialized exports
export const syncConfigFromGitHub = async (token: string) => apiFetch('config/sync/pull', { method: 'POST' });
export const pushConfigToGitHub = async (token: string) => apiFetch('config/sync/push', { method: 'POST' });
export const sendUpdateEmailToDelegate = async (token: string, eventId: string, regId: string) => apiFetch('communications/send-update', { method: 'POST', body: JSON.stringify({ eventId, regId }) });
export const generateImage = async (prompt: string) => apiFetch('ai/generate-image', { method: 'POST', body: JSON.stringify({ prompt }) }).then(r => r.url);
export const recordMealConsumption = async (token: string, delegateId: string, mealType: string) => apiFetch('dining/record-meal', { method: 'POST', body: JSON.stringify({ delegateId, mealType }) });
export const assignMealPlan = async (token: string, mealPlanId: string, startDate: string, endDate: string) => apiFetch('dining/assign-plan', { method: 'POST', body: JSON.stringify({ mealPlanId, startDate, endDate }) });
export const bookAccommodation = async (token: string, hotelId: string, roomTypeId: string, checkInDate: string, checkOutDate: string) => apiFetch('accommodation/book', { method: 'POST', body: JSON.stringify({ hotelId, roomTypeId, checkInDate, checkOutDate }) });
export const cancelAccommodationBooking = async (token: string, bookingId: string) => apiFetch(`accommodation/bookings/${bookingId}`, { method: 'DELETE' });
export const selfCheckOut = async (token: string, bookingId: string) => apiFetch(`accommodation/bookings/${bookingId}/checkout`, { method: 'POST' });
export const updateBookingStatus = async (token: string, bookingId: string, status: string) => apiFetch(`accommodation/bookings/${bookingId}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
export const generateHotelRooms = async (token: string, hotelId: string, roomTypeId: string, count: number, startNumber: number) => apiFetch('accommodation/rooms/generate', { method: 'POST', body: JSON.stringify({ hotelId, roomTypeId, count, startNumber }) });
export const getAvailableRooms = async (token: string, hotelId: string, roomTypeId: string) => apiFetch(`accommodation/hotels/${hotelId}/rooms/available?roomTypeId=${roomTypeId}`);
export const assignRoomToBooking = async (token: string, bookingId: string, roomId: string) => apiFetch(`accommodation/bookings/${bookingId}/assign-room`, { method: 'POST', body: JSON.stringify({ roomId }) });
export const getAllRooms = async (token: string, hotelId: string) => apiFetch(`accommodation/hotels/${hotelId}/rooms`);
export const updateRoomStatus = async (token: string, roomId: string, status: string) => apiFetch(`accommodation/rooms/${roomId}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
export const processCheckOut = async (token: string, bookingId: string) => apiFetch(`accommodation/bookings/${bookingId}/checkout`, { method: 'POST' });
export const createAdminAccommodationBooking = async (token: string, delegateId: string, hotelId: string, roomTypeId: string, checkInDate: string, checkOutDate: string) => apiFetch('accommodation/book/admin', { method: 'POST', body: JSON.stringify({ delegateId, hotelId, roomTypeId, checkInDate, checkOutDate }) });
export const makeDiningReservation = async (token: string, restaurantId: string, reservationTime: string, partySize: number) => apiFetch('dining/reservations', { method: 'POST', body: JSON.stringify({ restaurantId, reservationTime, partySize }) });
export const getReservationsForRestaurant = async (token: string, restaurantId: string) => apiFetch(`dining/restaurants/${restaurantId}/reservations`);
export const createAdminDiningReservation = async (token: string, data: any) => apiFetch('dining/reservations/admin', { method: 'POST', body: JSON.stringify(data) });
export const deleteDiningReservation = async (token: string, id: string) => apiFetch(`dining/reservations/${id}`, { method: 'DELETE' });
export const sendDelegateInvitation = async (token: string, eventId: string, email: string) => apiFetch('communications/invite', { method: 'POST', body: JSON.stringify({ eventId, email }) });
export const saveScavengerHuntItem = async (token: string, data: any) => {
    if (data.id) return apiFetch(`data/scavenger_hunt_items/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    return apiFetch('data/scavenger_hunt_items', { method: 'POST', body: JSON.stringify(data) });
};
export const deleteScavengerHuntItem = async (token: string, id: string) => apiFetch(`data/scavenger_hunt_items/${id}`, { method: 'DELETE' });
