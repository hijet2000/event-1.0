
import { defaultConfig } from './config';
import { ALL_PERMISSIONS } from '../types';
import { hashPassword } from './auth';

// This will be our in-memory database
export const db: any = {
    roles: [],
    adminUsers: [],
    events: [],
    registrations: [],
    tasks: [],
    speakers: [],
    sponsors: [],
    sessions: [],
    hotels: [],
    roomTypes: [],
    hotelRooms: [],
    accommodationBookings: [],
    mealPlans: [],
    mealPlanAssignments: [],
    mealConsumptionLogs: [],
    restaurants: [],
    diningReservations: [],
    transactions: [],
    passwordResetTokens: [],
    inviteTokens: [],
    agendaSelections: [], // Stores { delegateId, sessionId }
    emailLogs: [], // Stores history of sent emails
    media: [], // Stores uploaded file metadata and content
    networkingProfiles: [], // Stores delegate networking info
    sessionFeedback: [], // Stores ratings and comments
    scavengerHuntItems: [], // Gamification challenges
    scavengerHuntLogs: [], // User completion records
};

const STORAGE_KEY = 'event_platform_db_v1';
let initializationPromise: Promise<void> | null = null;

export const saveDb = () => {
    // Only save if we are fully initialized to prevent overwriting with empty state during startup
    if (!initializationPromise) return;
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
        console.error("Failed to save DB to local storage", e);
    }
};

// Used by db.ts to refresh memory when another tab updates localStorage
export const reloadTable = (tableName: string) => {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
            const parsed = JSON.parse(storedData);
            if (Array.isArray(parsed[tableName])) {
                db[tableName] = parsed[tableName];
            }
        }
    } catch (e) {
        console.error(`Failed to reload table ${tableName}`, e);
    }
};

export const initializeDb = async () => {
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
        try {
            // 1. Try to load from local storage first
            try {
                const storedData = localStorage.getItem(STORAGE_KEY);
                if (storedData) {
                    const parsed = JSON.parse(storedData);
                    // Merge stored data into db object
                    Object.keys(parsed).forEach(key => {
                        if (Array.isArray(parsed[key])) {
                            db[key] = parsed[key];
                        }
                    });
                    console.log('Database loaded from local storage.');
                }
            } catch (e) {
                console.error("Failed to load or parse stored DB, reverting to seed.", e);
            }

            // 2. Ensure Roles Exist (Merge if missing)
            try {
                const requiredRoles = [
                    { id: 'role_super_admin', name: 'Super Admin', description: 'Has all permissions.', permissions: Object.keys(ALL_PERMISSIONS) },
                    { id: 'role_event_manager', name: 'Event Manager', description: 'Can manage registrations and view the dashboard.', permissions: ['view_dashboard', 'manage_registrations', 'send_invitations'] }
                ];

                for (const role of requiredRoles) {
                    if (!db.roles.find((r: any) => r.id === role.id)) {
                        db.roles.push(role);
                    }
                }
            } catch (e) { console.error("Error seeding roles", e); }
            
            // 3. Ensure Admin User Exists and is valid.
            try {
                const adminEmail = 'admin@example.com';
                const defaultPasswordHash = await hashPassword('password');

                const existingAdminIndex = db.adminUsers.findIndex((u: any) => u.email === adminEmail);
                
                if (existingAdminIndex === -1) {
                    console.log('Seeding default admin user (admin@example.com / password)...');
                    db.adminUsers.push({ 
                        id: 'user_admin_1', 
                        email: adminEmail, 
                        passwordHash: defaultPasswordHash, 
                        roleId: 'role_super_admin',
                        createdAt: Date.now() 
                    });
                } else {
                    // Force update credentials to guarantee login works in case of hash algorithm changes or corrupt data
                    db.adminUsers[existingAdminIndex].passwordHash = defaultPasswordHash;
                    db.adminUsers[existingAdminIndex].roleId = 'role_super_admin';
                }
            } catch (e) { console.error("Error seeding admin", e); }

            // 4. Ensure Default Event Exists
            try {
                if (!db.events.find((e: any) => e.id === 'main-event')) {
                     console.log('Seeding default event configuration...');
                     db.events.push({ id: 'main-event', config: defaultConfig });
                }
            } catch (e) { console.error("Error seeding default event", e); }

            // 5. Seed sample registrations only if completely empty and no storage data found
            try {
                // Check if we loaded data (registrations > 0) to decide if we seed
                if (db.registrations.length === 0) {
                    const regPasswordHash = await hashPassword('password123');
                    const now = Date.now();
                    db.registrations.push(
                        { id: 'reg_1', eventId: 'main-event', name: 'Alice Johnson', email: 'alice@example.com', passwordHash: regPasswordHash, createdAt: now - 86400000 * 2, customFields: { company: 'Tech Corp', job_title: 'Developer' }, checkedIn: true },
                        { id: 'reg_2', eventId: 'main-event', name: 'Bob Williams', email: 'bob@example.com', passwordHash: regPasswordHash, createdAt: now - 86400000, customFields: { company: 'Innovate LLC', job_title: 'Designer' }, checkedIn: false },
                        { id: 'reg_3', eventId: 'main-event', name: 'Charlie Brown', email: 'charlie@example.com', passwordHash: regPasswordHash, createdAt: now, customFields: { company: 'Data Systems', job_title: 'Analyst' }, checkedIn: false }
                    );
                }
            } catch (e) { console.error("Error seeding sample registrations", e); }
            
            // 6. Persist the sanitized/seeded state immediately
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
            } catch(e) {
                console.error("Failed to save initial state", e);
            }
            
            console.log('In-memory database initialized and synchronized.');
        } catch (err) {
            console.error("Critical DB Initialization Error:", err);
        }
    })();
    
    return initializationPromise;
};
