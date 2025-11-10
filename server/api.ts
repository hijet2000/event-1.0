import { store } from './store';
import { type AdminUser, type EventConfig, type RegistrationData, type Permission, type PublicEvent, type Role, type DashboardStats, type Task, type Hotel, type MealPlan, type Restaurant, type EventCoinStats, type Transaction, EventData, DelegateProfile } from '../types';
import { generateToken, verifyToken, comparePassword, hashPassword } from './auth';
import * as geminiService from '../services/geminiService';
import * as emailService from './email';
import { defaultConfig } from './config';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- PUBLIC/DELEGATE APIS ---

export const getPublicEventData = async (eventId: string = 'main-event'): Promise<{ config: EventConfig; registrationCount: number }> => {
  await delay(500);
  const event = store.events[eventId];
  if (!event) throw new Error('Event not found.');
  return {
    config: event.config,
    registrationCount: event.registrations.length,
  };
};

export const listPublicEvents = async (): Promise<PublicEvent[]> => {
    await delay(500);
    return Object.entries(store.events).map(([id, eventData]) => ({
        id,
        name: eventData.config.event.name,
        date: eventData.config.event.date,
        location: eventData.config.event.location,
        logoUrl: eventData.config.theme.logoUrl,
        colorPrimary: eventData.config.theme.colorPrimary,
    }));
};

export const registerUser = async (eventId: string, data: RegistrationData, inviteToken?: string): Promise<{ success: boolean; message: string }> => {
  await delay(1000);
  const event = store.events[eventId];
  if (!event) return { success: false, message: 'Event not found.' };

  if (event.registrations.some(r => r.email === data.email)) {
    return { success: false, message: 'This email address is already registered.' };
  }
  if (!data.password) {
    return { success: false, message: 'Password is required.' };
  }
  const passwordHash = await hashPassword(data.password);
  const newUser: RegistrationData = {
    ...data,
    id: `reg_${Date.now()}`,
    createdAt: Date.now(),
    passwordHash,
  };
  delete newUser.password;
  event.registrations.push(newUser);

  if (inviteToken) {
    store.inviteTokens.delete(inviteToken);
  }

  return { success: true, message: 'Registration successful.' };
};

export const triggerRegistrationEmails = async (eventId: string, registrationData: RegistrationData): Promise<void> => {
    const event = store.events[eventId];
    if (!event) throw new Error("Event not found");

    const verificationLink = `${window.location.origin}/${eventId}/verify?token=fake-verify-token`;
    const emails = await geminiService.generateRegistrationEmails(registrationData, event.config, verificationLink);

    await Promise.all([
        emailService.sendEmail({ to: registrationData.email, ...emails.userEmail }, event.config),
        emailService.sendEmail({ to: event.config.host.email, ...emails.hostEmail }, event.config),
    ]);
};

export const getInvitationDetails = async (inviteToken: string): Promise<{ inviteeEmail: string, eventId: string } | null> => {
    const invite = store.inviteTokens.get(inviteToken);
    if (invite && invite.expires > Date.now()) {
        return { inviteeEmail: invite.inviteeEmail, eventId: invite.eventId };
    }
    return null;
};

export const loginDelegate = async (eventId: string, email: string, password_input: string): Promise<{ token: string } | null> => {
    await delay(500);
    const event = store.events[eventId];
    if (!event) return null;

    const user = event.registrations.find(u => u.email === email);
    if (user && user.passwordHash && await comparePassword(password_input, user.passwordHash)) {
        const token = generateToken({ id: user.id!, email: user.email, type: 'delegate', eventId });
        return { token };
    }
    return null;
};

export const getDelegateProfile = async (delegateToken: string): Promise<DelegateProfile> => {
    await delay(500);
    const payload = verifyToken(delegateToken);
    if (!payload || payload.type !== 'delegate' || !payload.eventId) {
        throw new Error("Invalid or expired token.");
    }
    const event = store.events[payload.eventId];
    const user = event.registrations.find(r => r.id === payload.id);
    if (!user) throw new Error("User not found.");

    return {
        user,
        mealPlanAssignment: store.mealPlanAssignments.find(mpa => mpa.delegateId === user.id) || null,
        restaurants: store.restaurants,
        accommodationBooking: store.accommodationBookings.find(ab => ab.delegateId === user.id) || null,
        hotels: store.hotels,
    };
};

export const updateDelegateProfile = async (delegateToken: string, data: Partial<RegistrationData>): Promise<RegistrationData> => {
    await delay(500);
    const payload = verifyToken(delegateToken);
    if (!payload || payload.type !== 'delegate' || !payload.eventId) throw new Error("Invalid token.");

    const event = store.events[payload.eventId];
    const userIndex = event.registrations.findIndex(r => r.id === payload.id);
    if (userIndex === -1) throw new Error("User not found.");

    const updatedUser = { ...event.registrations[userIndex], ...data };
    event.registrations[userIndex] = updatedUser;
    
    return updatedUser;
};


// --- ADMIN APIS ---

export const getEventConfig = async (eventId: string = 'main-event'): Promise<EventConfig> => {
  await delay(500);
  const event = store.events[eventId];
  if (!event) throw new Error("Event not found");
  return event.config;
};

export const saveConfig = async (adminToken: string, newConfig: EventConfig, eventId: string = 'main-event'): Promise<EventConfig> => {
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");
    await delay(1000);
    const event = store.events[eventId];
    if (!event) throw new Error("Event not found");
    event.config = newConfig;
    return event.config;
};

export const loginAdmin = async (email: string, password_input: string): Promise<{ token: string, user: {id: string; email: string, permissions: Permission[]} } | null> => {
    await delay(500);
    const user = store.adminUsers.find(u => u.email === email);
    if (user && await comparePassword(password_input, user.passwordHash)) {
        const role = store.roles.find(r => r.id === user.roleId);
        const permissions = role?.permissions || [];
        const token = generateToken({ id: user.id, email: user.email, permissions, type: 'admin' });
        return { token, user: { id: user.id, email: user.email, permissions } };
    }
    return null;
};

export const getDashboardStats = async (adminToken: string, eventId: string = 'main-event'): Promise<DashboardStats> => {
    await delay(700);
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");
    
    const event = store.events[eventId];
    if (!event) throw new Error("Event not found");

    const recentRegistrations = [...event.registrations].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

    return {
        totalRegistrations: event.registrations.length,
        maxAttendees: event.config.event.maxAttendees,
        eventDate: event.config.event.date,
        eventCoinName: event.config.eventCoin.name,
        eventCoinCirculation: store.transactions.filter(t => t.type === 'initial').reduce((sum, t) => sum + t.amount, 0),
        recentRegistrations,
    };
};

export const getRegistrations = async (adminToken: string, eventId: string = 'main-event'): Promise<RegistrationData[]> => {
    await delay(800);
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");
    
    const event = store.events[eventId];
    if (!event) throw new Error("Event not found");

    return [...event.registrations].sort((a,b) => b.createdAt - a.createdAt);
};

export const getAdminUsers = async (adminToken: string): Promise<AdminUser[]> => {
    await delay(300);
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");
    return store.adminUsers;
};

export const getRoles = async (adminToken: string): Promise<Role[]> => {
    await delay(300);
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");
    return store.roles;
};

export const getTasks = async (adminToken: string, eventId: string): Promise<Task[]> => {
    await delay(400);
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");
    return store.tasks.filter(t => t.eventId === eventId);
};

export const saveTask = async (adminToken: string, taskData: Partial<Task>): Promise<Task> => {
    await delay(500);
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");
    if (taskData.id) {
        const index = store.tasks.findIndex(t => t.id === taskData.id);
        if (index > -1) {
            store.tasks[index] = { ...store.tasks[index], ...taskData };
            return store.tasks[index];
        }
    }
    const newTask: Task = {
        id: `task_${Date.now()}`,
        status: 'todo',
        ...taskData
    } as Task;
    store.tasks.push(newTask);
    return newTask;
};

export const deleteTask = async (adminToken: string, taskId: string): Promise<void> => {
    await delay(500);
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");
    store.tasks = store.tasks.filter(t => t.id !== taskId);
};


export const createEvent = async (adminToken: string, name: string, eventType: string): Promise<EventData> => {
    await delay(1000);
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");
    
    const newEventId = name.toLowerCase().replace(/\s+/g, '-') + `-${Date.now()}`;
    const newConfig = JSON.parse(JSON.stringify(defaultConfig));
    newConfig.event.name = name;
    newConfig.event.eventType = eventType;

    store.events[newEventId] = {
        config: newConfig,
        registrations: []
    };
    return { id: newEventId, name, config: newConfig };
};

export const requestAdminPasswordReset = async (email: string): Promise<void> => {
    await delay(500);
    console.log(`Password reset requested for admin: ${email}`);
};

export const requestDelegatePasswordReset = async (email: string): Promise<void> => {
    await delay(500);
    console.log(`Password reset requested for delegate: ${email}`);
};


export const resetPassword = async (token: string, newPassword_input: string): Promise<void> => {
    await delay(1000);
    console.log(`Password reset for token ${token}`);
};


export const syncConfigFromGitHub = async (adminToken: string, eventId: string = 'main-event'): Promise<EventConfig> => {
    await delay(1500);
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");
    const event = store.events[eventId];
    if (!event) throw new Error("Event not found.");
    
    const url = event.config.githubSync.configUrl;
    if (!url) {
        event.config.githubSync.lastSyncStatus = 'failure';
        event.config.githubSync.lastSyncMessage = 'GitHub Raw JSON URL is not configured.';
        throw new Error(event.config.githubSync.lastSyncMessage);
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch config from GitHub: ${response.statusText}`);
        const githubConfig = await response.json();

        // Basic validation
        if (!githubConfig.event || !githubConfig.theme) {
             throw new Error("Fetched JSON is not a valid EventConfig format.");
        }
        
        event.config = { ...event.config, ...githubConfig, githubSync: { ...event.config.githubSync, ...githubConfig.githubSync } };
        event.config.githubSync.lastSyncTimestamp = Date.now();
        event.config.githubSync.lastSyncStatus = 'success';
        event.config.githubSync.lastSyncMessage = 'Sync successful.';
        return event.config;
    } catch(e) {
        const message = e instanceof Error ? e.message : 'Unknown error during sync.';
        event.config.githubSync.lastSyncTimestamp = Date.now();
        event.config.githubSync.lastSyncStatus = 'failure';
        event.config.githubSync.lastSyncMessage = message;
        throw new Error(message);
    }
};

export const bulkImportRegistrations = async (adminToken: string, csvData: string, eventId: string = 'main-event'): Promise<{ successCount: number, errorCount: number, errors: string[] }> => {
    await delay(2000);
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");

    const event = store.events[eventId];
    if (!event) throw new Error("Event not found");

    const lines = csvData.trim().split('\n');
    const header = lines.shift()?.trim().split(',');

    if (!header || header[0]?.toLowerCase() !== 'name' || header[1]?.toLowerCase() !== 'email') {
        throw new Error('Invalid CSV format. Header must be "name,email".');
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const passwordHash = await hashPassword('password123'); // Default password

    for (const line of lines) {
        const [name, email] = line.trim().split(',');
        if (name && email && !event.registrations.some(r => r.email === email)) {
            event.registrations.push({ id: `reg_${Date.now()}_${successCount}`, name, email, passwordHash, createdAt: Date.now() });
            successCount++;
        } else {
            errorCount++;
            errors.push(`Skipped line (duplicate or invalid): ${line}`);
        }
    }

    return { successCount, errorCount, errors };
};

export const saveAdminUser = async (adminToken: string, data: Partial<AdminUser> & { password?: string }): Promise<void> => {
    await delay(500);
    console.log("Saving user", data);
};

export const deleteAdminUser = async (adminToken: string, userId: string): Promise<void> => {
    await delay(500);
    console.log("Deleting user", userId);
};

export const saveRole = async (adminToken: string, data: Partial<Role>): Promise<void> => {
    await delay(500);
    console.log("Saving role", data);
};

export const deleteRole = async (adminToken: string, roleId: string): Promise<void> => {
    await delay(500);
    console.log("Deleting role", roleId);
};

export const getEventCoinStats = async (adminToken: string): Promise<EventCoinStats> => {
    await delay(500);
    return {
        totalCirculation: 150000,
        totalTransactions: 450,
        activeWallets: 150,
    };
};
export const getAllTransactions = async (adminToken: string): Promise<Transaction[]> => {
    await delay(500);
    return [];
};

export const generateAiContent = async (adminToken: string, type: 'hotel' | 'room' | 'menu' | 'meal_plan', context: Record<string, string>): Promise<string> => {
    await delay(2000);
    const payload = verifyToken(adminToken);
    if (!payload || payload.type !== 'admin') throw new Error("Permission denied.");

    return await geminiService.generateHotelContent(type, context);
}

// Placeholder functions for dining/accommodation management
export const getHotels = async (adminToken: string): Promise<Hotel[]> => { await delay(300); return store.hotels; };
export const saveHotel = async (adminToken: string, hotel: Partial<Hotel>): Promise<Hotel> => {
    await delay(500);
    if (hotel.id) {
        const index = store.hotels.findIndex(h => h.id === hotel.id);
        if (index > -1) {
            store.hotels[index] = { ...store.hotels[index], ...hotel };
            return store.hotels[index];
        }
    }
    const newHotel: Hotel = { id: `hotel_${Date.now()}`, ...hotel } as Hotel;
    store.hotels.push(newHotel);
    return newHotel;
};
export const deleteHotel = async (adminToken: string, id: string): Promise<void> => { store.hotels = store.hotels.filter(h => h.id !== id); };

export const getMealPlans = async (adminToken: string): Promise<MealPlan[]> => { await delay(300); return store.mealPlans; };
export const saveMealPlan = async (adminToken: string, plan: Partial<MealPlan>): Promise<MealPlan> => {
    await delay(500);
     if (plan.id) {
        const index = store.mealPlans.findIndex(p => p.id === plan.id);
        if (index > -1) {
            store.mealPlans[index] = { ...store.mealPlans[index], ...plan };
            return store.mealPlans[index];
        }
    }
    const newPlan: MealPlan = { id: `plan_${Date.now()}`, ...plan } as MealPlan;
    store.mealPlans.push(newPlan);
    return newPlan;
};
export const deleteMealPlan = async (adminToken: string, id: string): Promise<void> => { store.mealPlans = store.mealPlans.filter(p => p.id !== id);};

export const getRestaurants = async (adminToken: string): Promise<Restaurant[]> => { await delay(300); return store.restaurants; };
export const saveRestaurant = async (adminToken: string, restaurant: Partial<Restaurant>): Promise<Restaurant> => {
    await delay(500);
    if (restaurant.id) {
        const index = store.restaurants.findIndex(r => r.id === restaurant.id);
        if (index > -1) {
            store.restaurants[index] = { ...store.restaurants[index], ...restaurant };
            return store.restaurants[index];
        }
    }
    const newRest: Restaurant = { id: `rest_${Date.now()}`, ...restaurant } as Restaurant;
    store.restaurants.push(newRest);
    return newRest;
};
export const deleteRestaurant = async (adminToken: string, id: string): Promise<void> => { store.restaurants = store.restaurants.filter(r => r.id !== id); };

export const getReservationsForRestaurant = async (adminToken: string, restaurantId: string) => { await delay(500); return store.diningReservations.filter(r => r.restaurantId === restaurantId); };
