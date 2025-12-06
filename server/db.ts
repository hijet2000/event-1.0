
import { db, initializeDb, saveDb, reloadTable } from './store';

// Make sure DB is initialized before any operation
const ensureInitialized = async () => {
    await initializeDb();
};

type TableName = string;

function deepCopy(data: any): any {
    return JSON.parse(JSON.stringify(data));
}

// --- Real-time Sync Logic ---

// Event Emitter for local subscribers
type Listener = (table: string) => void;
const listeners: Set<Listener> = new Set();

export const subscribe = (callback: Listener) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

export const notifySubscribers = (table: string) => {
    listeners.forEach(cb => cb(table));
};

// 1. BroadcastChannel for fast cross-tab sync
let channel: BroadcastChannel | null = null;

try {
    if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('event_platform_sync');
        channel.onmessage = (event) => {
            const { action, table } = event.data;
            if (action === 'refresh' && table) {
                // Reload data from LocalStorage (which was updated by another tab)
                reloadTable(table);
                // Notify React components in this tab
                notifySubscribers(table);
            }
        };
    }
} catch (e) {
    console.warn("BroadcastChannel not supported or restricted. Cross-tab sync disabled.");
}

// 2. Storage Event Listener as a fallback/supplement for cross-tab sync
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key === 'event_platform_db_v1' && event.newValue) {
            // The DB key changed, we reload everything or specific tables if we tracked diffs.
            // Since we store whole DB in one key, we just parse it and see.
            // Ideally, we reload all tables that components are watching.
            // Simple brute force reload:
            try {
                const parsed = JSON.parse(event.newValue);
                Object.keys(parsed).forEach(key => {
                    if (Array.isArray(parsed[key])) {
                        db[key] = parsed[key];
                        notifySubscribers(key);
                    }
                });
            } catch (e) {
                console.error("Failed to sync from storage event", e);
            }
        }
    });
}

const notifyChange = (table: string) => {
    // 1. Notify local components
    notifySubscribers(table);
    // 2. Notify other tabs via BroadcastChannel
    channel?.postMessage({ action: 'refresh', table });
};

// --- CRUD Operations ---

export async function findAll(table: TableName, predicate?: (item: any) => boolean): Promise<any[]> {
    await ensureInitialized();
    const tableData = (db[table] || []) as any[];
    if (predicate) {
        return deepCopy(tableData.filter(predicate));
    }
    return deepCopy(tableData);
}

export async function find(table: TableName, predicate: (item: any) => boolean): Promise<any | undefined> {
    await ensureInitialized();
    const tableData = (db[table] || []) as any[];
    const item = tableData.find(predicate);
    return item ? deepCopy(item) : undefined;
}

export async function insert(table: TableName, item: any): Promise<any> {
    await ensureInitialized();
    if (!db[table]) {
        db[table] = [];
    }
    db[table].push(item);
    saveDb();
    notifyChange(table); // Trigger updates
    return deepCopy(item);
}

export async function update(table: TableName, id: any, updates: any): Promise<any | undefined> {
    await ensureInitialized();
    const tableData = (db[table] || []) as any[];
    const itemIndex = tableData.findIndex(i => i.id === id);
    if (itemIndex > -1) {
        tableData[itemIndex] = { ...tableData[itemIndex], ...updates };
        saveDb();
        notifyChange(table); // Trigger updates
        return deepCopy(tableData[itemIndex]);
    }
    return undefined;
}

export async function updateWhere(table: TableName, predicate: (item: any) => boolean, updates: any): Promise<any[]> {
    await ensureInitialized();
    const updatedItems: any[] = [];
    let hasChanges = false;
    if (db[table]) {
        db[table] = (db[table] as any[]).map((item: any) => {
            if (predicate(item)) {
                const updated = { ...item, ...updates };
                updatedItems.push(updated);
                hasChanges = true;
                return updated;
            }
            return item;
        });
        if (hasChanges) {
            saveDb();
            notifyChange(table); // Trigger updates
        }
    }
    return deepCopy(updatedItems);
}

export async function remove(table: TableName, id: any): Promise<boolean> {
    await ensureInitialized();
    if (!db[table]) return false;
    const initialLength = db[table].length;
    db[table] = (db[table] as any[]).filter((i: any) => i.id !== id);
    const changed = db[table].length < initialLength;
    if (changed) {
        saveDb();
        notifyChange(table); // Trigger updates
    }
    return changed;
}

export async function removeWhere(table: TableName, predicate: (item: any) => boolean): Promise<boolean> {
    await ensureInitialized();
    if (!db[table]) return false;
    const initialLength = db[table].length;
    db[table] = (db[table] as any[]).filter((item: any) => !predicate(item));
    const changed = db[table].length < initialLength;
    if (changed) {
        saveDb();
        notifyChange(table); // Trigger updates
    }
    return changed;
}

export async function count(table: TableName, predicate?: (item: any) => boolean): Promise<number> {
    await ensureInitialized();
    if (!db[table]) return 0;
    if (!predicate) return db[table].length;
    return (db[table] as any[]).filter(predicate).length;
}
