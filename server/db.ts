
import { db, initializeDb, saveDb, reloadTable } from './store';

export { initializeDb };

// Make sure DB is initialized before any operation
const ensureInitialized = async () => {
    await initializeDb();
};

type TableName = string;

// Network State
let isOnline = false;

export const setBackendAvailable = (status: boolean) => {
    isOnline = status;
};

// Helper to get headers with token
const getAuthHeaders = () => {
    const adminToken = localStorage.getItem('adminToken');
    const delegateToken = localStorage.getItem('delegateToken');
    const token = adminToken || delegateToken;
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const replaceTable = (table: TableName, data: any[]) => {
    db[table] = data;
    notifySubscribers(table);
};

export const syncWithBackend = async () => {
    if (!isOnline) return;
    try {
        console.log("Syncing with backend...");
        const res = await fetch('/api/sync', {
            headers: getAuthHeaders()
        });
        if (res.ok) {
            const remoteData = await res.json();
            Object.keys(remoteData).forEach(key => {
                db[key] = remoteData[key];
            });
            saveDb();
            // Notify all tables
            Object.keys(remoteData).forEach(notifySubscribers);
            console.log("Sync complete.");
        }
    } catch (e) {
        console.error("Sync failed", e);
    }
};

export const fetchTableFromBackend = async (table: TableName) => {
    if (!isOnline) return;
    try {
        const res = await fetch(`/api/data/${table}`, {
            headers: getAuthHeaders()
        });
        if (res.ok) {
            const data = await res.json();
            db[table] = data;
            notifySubscribers(table);
        }
    } catch (e) {
        console.error(`Failed to fetch table ${table}`, e);
    }
};

function deepCopy(data: any): any {
    return JSON.parse(JSON.stringify(data));
}

// --- Real-time Sync Logic ---

type Listener = (table: string) => void;
const listeners: Set<Listener> = new Set();

export const subscribe = (callback: Listener) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

export const notifySubscribers = (table: string) => {
    listeners.forEach(cb => cb(table));
};

// BroadcastChannel for cross-tab sync
let channel: BroadcastChannel | null = null;
try {
    if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('event_platform_sync');
        channel.onmessage = (event) => {
            const { action, table } = event.data;
            if (action === 'refresh' && table) {
                reloadTable(table);
                notifySubscribers(table);
            }
        };
    }
} catch (e) {}

const notifyChange = (table: string) => {
    notifySubscribers(table);
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
    notifyChange(table);
    
    // Sync to backend if online
    if (isOnline) {
        fetch(`/api/data/${table}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(item)
        }).catch(e => console.error("Backend insert failed", e));
    }
    
    return deepCopy(item);
}

export async function update(table: TableName, id: any, updates: any): Promise<any | undefined> {
    await ensureInitialized();
    const tableData = (db[table] || []) as any[];
    const itemIndex = tableData.findIndex(i => i.id === id);
    
    if (itemIndex > -1) {
        const updatedItem = { ...tableData[itemIndex], ...updates };
        tableData[itemIndex] = updatedItem;
        saveDb();
        notifyChange(table);
        
        // Sync to backend
        if (isOnline) {
            fetch(`/api/data/${table}`, {
                method: 'POST', // Backend handles upsert logic via POST currently
                headers: getAuthHeaders(),
                body: JSON.stringify(updatedItem)
            }).catch(e => console.error("Backend update failed", e));
        }
        
        return deepCopy(updatedItem);
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
                
                // Sync individually
                if (isOnline) {
                    fetch(`/api/data/${table}`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(updated)
                    }).catch(e => console.error("Backend updateWhere failed", e));
                }
                
                return updated;
            }
            return item;
        });
        if (hasChanges) {
            saveDb();
            notifyChange(table);
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
        notifyChange(table);
        
        if (isOnline) {
            fetch(`/api/data/${table}/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).catch(e => console.error("Backend delete failed", e));
        }
    }
    return changed;
}

export async function removeWhere(table: TableName, predicate: (item: any) => boolean): Promise<boolean> {
    await ensureInitialized();
    if (!db[table]) return false;
    
    // Find items to delete first to get their IDs
    const itemsToDelete = (db[table] as any[]).filter(predicate);
    if (itemsToDelete.length === 0) return false;

    const initialLength = db[table].length;
    db[table] = (db[table] as any[]).filter((item: any) => !predicate(item));
    const changed = db[table].length < initialLength;
    
    if (changed) {
        saveDb();
        notifyChange(table);
        
        if (isOnline) {
            // Delete one by one
            itemsToDelete.forEach((item: any) => {
                if (item.id) {
                    fetch(`/api/data/${table}/${item.id}`, { 
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    })
                        .catch(e => console.error("Backend removeWhere failed", e));
                }
            });
        }
    }
    return changed;
}

export async function count(table: TableName, predicate?: (item: any) => boolean): Promise<number> {
    await ensureInitialized();
    if (!db[table]) return 0;
    if (!predicate) return db[table].length;
    return (db[table] as any[]).filter(predicate).length;
}
