
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
    ticket_tiers: [],
    venueMaps: [],
    settings: {},
    email_logs: []
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
