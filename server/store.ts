
export const db: any = {
    registrations: [],
    events: [],
    admin_users: [],
    roles: [],
    sessions: [],
    speakers: [],
    sponsors: [],
    tasks: [],
    meal_plans: [],
    restaurants: [],
    hotels: [],
    rooms: [],
    bookings: [],
    media: [],
    notifications: [],
    transactions: [],
    messages: [],
    scavenger_hunt_items: [],
    scavenger_hunt_progress: [],
    networking_profiles: [],
    agenda_entries: [],
    ticket_tiers: [],
    venue_maps: [],
    email_logs: [],
    session_questions: [],
    session_feedback: [],
    poll_votes: [],
    polls: []
};

export const initializeDb = async () => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('event_platform_db_v1');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.keys(parsed).forEach(key => {
                db[key] = parsed[key];
            });
        }
    }

    // Seed default admin if missing (Mock Mode only)
    if (!db.admin_users || db.admin_users.length === 0) {
        const roleId = 'role_super_admin';
        
        const fullPermissions = [
            'view_dashboard', 'manage_registrations', 'manage_settings', 'manage_users',
            'manage_tasks', 'manage_dining', 'manage_accommodation', 'manage_agenda',
            'manage_speakers_sponsors', 'view_eventcoin_dashboard', 'manage_eventcoin',
            'send_invitations', 'manage_gamification', 'manage_communications',
            'manage_media', 'manage_marketing', 'manage_maps', 'view_system_status',
            'view_diagnostics'
        ];

        // Upsert super admin role
        const superAdminRole = {
            id: roleId,
            name: 'Super Admin',
            description: 'Full system access',
            permissions: fullPermissions
        };

        db.roles = [superAdminRole];

        // Create Admin
        db.admin_users.push({
            id: 'user_admin_01',
            email: 'admin@example.com',
            password_hash: '$2b$10$mockcGFzc3dvcmQ=', 
            roleId: roleId,
            createdAt: Date.now()
        });
        
        // Ensure default event exists
        if (!db.events || db.events.length === 0) {
             db.events.push({
                 id: 'main-event',
                 name: 'Tech Summit 2025',
                 eventType: 'Conference',
                 colorPrimary: '#4f46e5',
                 date: 'October 26, 2025',
                 location: 'Metropolis Convention Center',
                 created_at: Date.now(),
                 config: {
                    event: { 
                        name: 'Tech Summit 2025', 
                        date: 'October 26, 2025', 
                        location: 'Metropolis Convention Center',
                        description: 'Join us for the premier technology event of the year.',
                        maxAttendees: 500,
                        eventType: 'Conference',
                        publicUrl: 'http://localhost:3000'
                    },
                    host: { 
                        name: 'Event Core Team', 
                        email: 'contact@example.com' 
                    },
                    theme: { 
                        colorPrimary: '#4f46e5', 
                        colorSecondary: '#ec4899', 
                        backgroundColor: '#f9fafb', 
                        fontFamily: 'Inter', 
                        logoUrl: '', 
                        pageImageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=2070',
                        websiteUrl: '',
                        badgeImageUrl: ''
                    },
                    formFields: [],
                    emailTemplates: {},
                    emailProvider: 'smtp',
                    smtp: { host: '', port: 587, username: '', password: '', encryption: 'tls' },
                    googleConfig: { serviceAccountKeyJson: '', subjectEmail: '' },
                    badgeConfig: { showName: true, showEmail: false, showCompany: true, showRole: true },
                    eventCoin: { enabled: true, name: 'EventCoin', startingBalance: 100, exchangeRate: 1, peggedCurrency: 'USD' },
                    githubSync: { enabled: false, configUrl: '' },
                    whatsapp: { enabled: false, accessToken: '', phoneNumberId: '' },
                    telegram: { enabled: false, botToken: '' },
                    sms: { enabled: false, provider: 'twilio', accountSid: '', authToken: '', fromNumber: '' },
                    aiConcierge: { enabled: true, voice: 'Kore', persona: 'You are a helpful assistant.' }
                 }
             });
        }

        // SEED DEMO DELEGATE
        if (!db.registrations || db.registrations.length === 0) {
            db.registrations.push({
                id: 'reg_demo_001',
                eventId: 'main-event',
                name: 'Demo Delegate',
                email: 'delegate@example.com',
                company: 'Future Labs',
                role: 'Senior Researcher',
                status: 'confirmed',
                checkedIn: false,
                createdAt: Date.now()
            });
            
            // Give them some starting coins
            db.transactions.push({
                id: 'tx_init_demo',
                timestamp: Date.now(),
                fromId: 'system',
                toId: 'reg_demo_001',
                fromName: 'System',
                toName: 'Demo Delegate',
                fromEmail: 'system@event.com',
                toEmail: 'delegate@example.com',
                amount: 100,
                type: 'initial',
                message: 'Welcome Bonus'
            });
        }
        
        saveDb();
    }
};

export const saveDb = () => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('event_platform_db_v1', JSON.stringify(db));
    }
};

export const reloadTable = (table: string) => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('event_platform_db_v1');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed[table]) {
                db[table] = parsed[table];
            }
        }
    }
}
