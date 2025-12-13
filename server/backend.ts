


import express, { Request as ExpressRequest, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { researchEntity } from './geminiService';
import { Buffer } from 'buffer';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

// Load environment variables
dotenv.config();

// Fix for missing Node.js types
declare var __dirname: string;

// Extend Request to include user
interface AuthRequest extends ExpressRequest {
    user?: {
        id: string;
        email: string;
        type: 'admin' | 'delegate';
        permissions?: string[];
        eventId?: string;
    };
    // Explicitly add properties to resolve TS errors
    headers: any;
    params: any;
    body: any;
    query: any;
    file?: any;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all for dev; restrict in prod
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const JWT_SECRET = process.env.JWT_SECRET || 'mock_signature_secret';

// Initialize Stripe with key or placeholder
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2023-10-16',
    typescript: true
});

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Allow loading images from uploads
}));
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Serve Uploads
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 2000, // Limit each IP
	standardHeaders: true,
	legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// --- Database Abstraction Layer ---

const ALLOWED_TABLES = [
    'registrations', 'events', 'sessions', 'speakers', 'sponsors', 'tasks', 
    'meal_plans', 'restaurants', 'hotels', 'rooms', 'bookings', 'media', 
    'notifications', 'transactions', 'scavenger_hunt_items', 'scavenger_hunt_progress', 
    'networking_profiles', 'agenda_entries', 'ticket_tiers', 'venue_maps', 
    'email_logs', 'session_questions', 'session_feedback', 'poll_votes', 'polls',
    'admin_users', 'roles', 'messages'
];

class DatabaseService {
    private pool: Pool | null = null;
    private memoryDb: Record<string, any[]> = {};
    private usePostgres = false;

    constructor() {
        // Initialize Memory DB
        ALLOWED_TABLES.forEach(t => this.memoryDb[t] = []);
        this.loadMemoryDb();

        // Initialize Postgres
        if (process.env.DATABASE_URL) {
            this.pool = new Pool({ 
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });
            
            this.pool.query('SELECT NOW()')
                .then(() => {
                    console.log('🐘 Connected to PostgreSQL');
                    this.usePostgres = true;
                })
                .catch(err => {
                    console.error('⚠️ PostgreSQL connection failed, falling back to file storage.', err.message);
                    this.usePostgres = false;
                });
        } else {
            console.log('📂 No DATABASE_URL found, using file storage.');
        }
    }

    private loadMemoryDb() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const data = fs.readFileSync(DATA_FILE, 'utf-8');
                const loaded = JSON.parse(data);
                this.memoryDb = { ...this.memoryDb, ...loaded };
                console.log("📦 Database loaded from file.");
            }
        } catch (e) {
            console.error("Failed to load database file:", e);
        }
    }

    private saveMemoryDb() {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.memoryDb, null, 2));
        } catch (e) {
            console.error("Failed to save database file:", e);
        }
    }

    async findAll(table: string, predicate?: (item: any) => boolean) {
        if (this.usePostgres && this.pool) {
            try {
                if (!ALLOWED_TABLES.includes(table)) throw new Error("Invalid table");
                const res = await this.pool.query(`SELECT * FROM ${table}`);
                const items = res.rows.map(row => {
                    if (row.data && typeof row.data === 'object') {
                        return { ...row.data, ...row, data: undefined }; 
                    }
                    return row;
                });
                if (predicate) return items.filter(predicate);
                return items;
            } catch (e) {
                console.warn(`[PG] findAll failed for ${table}, using memory fallback.`, (e as Error).message);
            }
        }
        
        const items = this.memoryDb[table] || [];
        if (predicate) return items.filter(predicate);
        return items;
    }

    async findOne(table: string, predicate: (item: any) => boolean) {
        const items = await this.findAll(table, predicate);
        return items.length > 0 ? items[0] : null;
    }

    async insert(table: string, item: any) {
        if (!ALLOWED_TABLES.includes(table)) throw new Error("Invalid table");

        if (this.usePostgres && this.pool) {
            try {
                const keys = Object.keys(item);
                const cols = keys.join(', ');
                const vals = keys.map((_, i) => `$${i + 1}`).join(', ');
                const values = keys.map(k => {
                    const val = item[k];
                    return (typeof val === 'object') ? JSON.stringify(val) : val;
                });

                await this.pool.query(`INSERT INTO ${table} (${cols}) VALUES (${vals})`, values);
                return item;
            } catch (e) {
                console.warn(`[PG] Insert failed for ${table}, using memory.`, (e as Error).message);
            }
        }

        if (!this.memoryDb[table]) this.memoryDb[table] = [];
        this.memoryDb[table].push(item);
        this.saveMemoryDb();
        return item;
    }

    async update(table: string, id: string, updates: any) {
        if (!ALLOWED_TABLES.includes(table)) throw new Error("Invalid table");

        if (this.usePostgres && this.pool) {
            try {
                const keys = Object.keys(updates).filter(k => k !== 'id');
                if (keys.length === 0) return null;

                const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
                const values = keys.map(k => {
                     const val = updates[k];
                     return (typeof val === 'object') ? JSON.stringify(val) : val;
                });
                
                await this.pool.query(`UPDATE ${table} SET ${setClause} WHERE id = $1`, [id, ...values]);
                const res = await this.pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
                return res.rows[0];
            } catch (e) {
                console.warn(`[PG] Update failed for ${table}, using memory.`, (e as Error).message);
            }
        }

        const list = this.memoryDb[table] || [];
        const index = list.findIndex(i => i.id === id);
        if (index !== -1) {
            this.memoryDb[table][index] = { ...list[index], ...updates };
            this.saveMemoryDb();
            return this.memoryDb[table][index];
        }
        return null;
    }

    async remove(table: string, id: string) {
        if (!ALLOWED_TABLES.includes(table)) throw new Error("Invalid table");

        if (this.usePostgres && this.pool) {
            try {
                await this.pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
                return true;
            } catch (e) {
                console.warn(`[PG] Delete failed for ${table}, using memory.`, (e as Error).message);
            }
        }

        const list = this.memoryDb[table] || [];
        const initialLen = list.length;
        this.memoryDb[table] = list.filter(i => i.id !== id);
        if (this.memoryDb[table].length < initialLen) {
            this.saveMemoryDb();
            return true;
        }
        return false;
    }
}

const db = new DatabaseService();

// --- Helper Functions ---

const SAFE_DEFAULTS = {
    host: { name: 'Event Host', email: 'host@example.com' },
    event: { name: 'Event Name' },
    telegram: { enabled: false, botToken: '' },
    whatsapp: { enabled: false, accessToken: '', phoneNumberId: '' },
    sms: { enabled: false, accountSid: '', authToken: '', fromNumber: '' },
    smtp: { host: '', port: 587, username: '', password: '', encryption: 'tls' },
    googleConfig: { serviceAccountKeyJson: '' },
    emailProvider: 'smtp',
    eventCoin: { name: 'EventCoin', startingBalance: 100 }
};

const getSafeConfig = (rawConfig: any) => {
    if (!rawConfig) return SAFE_DEFAULTS;
    return {
        ...rawConfig,
        host: { ...SAFE_DEFAULTS.host, ...(rawConfig.host || {}) },
        event: { ...SAFE_DEFAULTS.event, ...(rawConfig.event || {}) },
        telegram: { ...SAFE_DEFAULTS.telegram, ...(rawConfig.telegram || {}) },
        whatsapp: { ...SAFE_DEFAULTS.whatsapp, ...(rawConfig.whatsapp || {}) },
        sms: { ...SAFE_DEFAULTS.sms, ...(rawConfig.sms || {}) },
        smtp: { ...SAFE_DEFAULTS.smtp, ...(rawConfig.smtp || {}) },
        googleConfig: { ...SAFE_DEFAULTS.googleConfig, ...(rawConfig.googleConfig || {}) },
        emailProvider: rawConfig.emailProvider || SAFE_DEFAULTS.emailProvider,
        eventCoin: { ...SAFE_DEFAULTS.eventCoin, ...(rawConfig.eventCoin || {}) }
    };
};

const comparePass = async (input: string, hash: string): Promise<boolean> => {
    // Support legacy mock hash for smooth transition
    if (hash.startsWith('$2b$10$mock')) {
        const computed = `$2b$10$mock${Buffer.from(input).toString('base64')}`;
        return computed === hash;
    }
    return await bcrypt.compare(input, hash);
};

const calculateBalance = async (userId: string) => {
    const events = await db.findAll('events');
    const event = events[0];
    const startingBalance = event?.config?.eventCoin?.startingBalance || 0;
    
    let balance = startingBalance;
    const transactions = await db.findAll('transactions');
    
    transactions.forEach((tx: any) => {
        if (tx.toId === userId) {
            balance += tx.amount;
        } else if (tx.fromId === userId) {
            balance -= tx.amount;
        }
    });
    
    return balance;
};

// --- Auth Middleware ---

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            // Fallback for legacy mock tokens during transition
            if (token.split('.').length === 3 && token.split('.')[2] === 'mock_signature_secret') {
                 try {
                    const base64Url = token.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
                    req.user = JSON.parse(jsonPayload);
                    return next();
                } catch (e) {}
            }
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// --- Socket.io Logic ---

const connectedUsers = new Map<string, string>();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', (room) => {
    socket.join(room);
  });

  socket.on('auth:register', (data) => {
      const { userId } = data;
      if (userId) {
          connectedUsers.set(userId, socket.id);
          console.log(`🔌 Socket mapped: User ${userId} -> Socket ${socket.id}`);
      }
  });

  socket.on('signal', (data) => {
    const { to, ...payload } = data;
    let senderId = '';
    for (let [uid, sid] of connectedUsers.entries()) {
        if (sid === socket.id) {
            senderId = uid;
            break;
        }
    }

    if (!senderId) {
        return;
    }

    if (to) {
        const targetSocketId = connectedUsers.get(to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('signal', { ...payload, senderId });
        }
    }
  });

  socket.on('chat:send', async (message) => {
    await db.insert('messages', message);
    io.emit('refresh:messages', message); 
    io.emit('refresh:data', { table: 'messages' });
  });

  socket.on('poll:vote', (data) => {
      io.emit('refresh:polls', { pollId: data.pollId });
      io.emit('refresh:data', { table: 'poll_votes' });
  });
  
  socket.on('poll:update', (data) => {
      io.emit('refresh:polls', data);
      io.emit('refresh:data', { table: 'polls' });
  });

  socket.on('disconnect', () => {
    for (let [uid, sid] of connectedUsers.entries()) {
        if (sid === socket.id) {
            connectedUsers.delete(uid);
            break;
        }
    }
  });
});

// --- API Routes ---

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Admin Login
app.post('/api/auth/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const users = await db.findAll('admin_users', (u) => u.email === email);
        const user = users[0];
        if (user && await comparePass(password, user.password_hash)) {
            const role = await db.findOne('roles', (r) => r.id === user.roleId);
            const token = jwt.sign({
                id: user.id,
                email: user.email,
                type: 'admin',
                permissions: role ? role.permissions : []
            }, JWT_SECRET, { expiresIn: '24h' });
            
            res.json({ token, user: { ...user, permissions: role ? role.permissions : [], password_hash: undefined } });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

// Delegate Login
app.post('/api/auth/delegate/login', async (req, res) => {
    const { eventId, email } = req.body;
    try {
        const users = await db.findAll('registrations', (u) => u.email === email);
        const user = users[0];
        
        if (user) {
            const token = jwt.sign({
                id: user.id,
                email: user.email,
                type: 'delegate',
                eventId
            }, JWT_SECRET, { expiresIn: '24h' });
            
            res.json({ token, user });
        } else {
            res.status(401).json({ error: 'Delegate not found' });
        }
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

// Register
app.post('/api/events/:eventId/register', async (req, res) => {
    const { eventId } = req.params;
    const data = req.body;
    
    try {
        const existing = await db.findOne('registrations', r => r.email === data.email);
        if (existing) {
            return res.json({ success: false, message: 'Email already registered.' });
        }
        
        const newUser = {
            ...data,
            id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            eventId,
            createdAt: Date.now(),
            status: data.status || 'confirmed'
        };
        
        await db.insert('registrations', newUser);
        res.json({ success: true, user: newUser });
    } catch (e) {
        res.status(500).json({ success: false, message: (e as Error).message });
    }
});

// GitHub Sync (Pull)
app.post('/api/admin/config/sync', authenticateToken, async (req: AuthRequest, res) => {
    if (!req.user || req.user.type !== 'admin') return res.sendStatus(403);
    
    try {
        const events = await db.findAll('events');
        const event = events[0]; // Assuming single event for now
        const ghConfig = event?.config?.githubSync;

        if (!ghConfig || (!ghConfig.configUrl && (!ghConfig.owner || !ghConfig.repo))) {
            return res.status(400).json({ error: "GitHub integration not configured." });
        }

        let newConfig;

        // Strategy 1: GitHub API (Preferred if token exists)
        if (ghConfig.token && ghConfig.owner && ghConfig.repo) {
            const path = ghConfig.path || 'config.json';
            const url = `https://api.github.com/repos/${ghConfig.owner}/${ghConfig.repo}/contents/${path}`;
            
            const ghRes = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${ghConfig.token}`,
                    'Accept': 'application/vnd.github.v3.raw',
                    'User-Agent': 'EventPlatform-Backend'
                }
            });

            if (!ghRes.ok) {
                const errText = await ghRes.text();
                throw new Error(`GitHub API Error: ${ghRes.status} ${errText}`);
            }
            newConfig = await ghRes.json();
        } 
        // Strategy 2: Raw URL (Public repos)
        else if (ghConfig.configUrl) {
            const rawRes = await fetch(ghConfig.configUrl);
            if (!rawRes.ok) throw new Error("Failed to fetch from Raw URL");
            newConfig = await rawRes.json();
        } else {
            throw new Error("Invalid GitHub configuration.");
        }

        // Validate structure minimally
        if (!newConfig.event || !newConfig.theme) {
            throw new Error("Invalid config format received from GitHub.");
        }

        // Preserve local secrets if they are missing in remote (optional safety)
        // For now, we overwrite, assuming secrets are managed via env or separate injection if needed.
        // However, we must ensure we don't wipe the githubSync config itself if the remote file lacks it!
        
        const mergedConfig = {
            ...newConfig,
            githubSync: {
                ...ghConfig, // Keep local credentials
                lastSyncTimestamp: Date.now(),
                lastSyncStatus: 'success'
            }
        };

        await db.update('events', event.id, { config: mergedConfig });
        res.json(mergedConfig);

    } catch (e) {
        console.error("Sync Error:", e);
        // Update status to failed in DB?
        res.status(500).json({ error: (e as Error).message });
    }
});

// GitHub Push (Commit)
app.post('/api/admin/config/push', authenticateToken, async (req: AuthRequest, res) => {
    if (!req.user || req.user.type !== 'admin') return res.sendStatus(403);

    try {
        const events = await db.findAll('events');
        const event = events[0];
        const config = event?.config;
        const ghConfig = config?.githubSync;

        if (!ghConfig || !ghConfig.token || !ghConfig.owner || !ghConfig.repo) {
            return res.status(400).json({ error: "GitHub integration not fully configured (Token required)." });
        }

        const filePath = ghConfig.path || 'config.json';
        const apiUrl = `https://api.github.com/repos/${ghConfig.owner}/${ghConfig.repo}/contents/${filePath}`;
        
        // 1. Get current file SHA (required for update)
        let sha: string | undefined;
        try {
            const getRes = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${ghConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'EventPlatform-Backend'
                }
            });
            if (getRes.ok) {
                const data = await getRes.json();
                sha = data.sha;
            } else if (getRes.status !== 404) {
                throw new Error(`Failed to check existing file: ${getRes.status}`);
            }
        } catch (e) {
            // ignore 404 (file doesn't exist yet)
        }

        // 2. Prepare content - STRIP SECRETS
        const configToPush = JSON.parse(JSON.stringify(config));
        
        // Sanitize
        if (configToPush.githubSync) configToPush.githubSync.token = ""; 
        if (configToPush.smtp) configToPush.smtp.password = "";
        if (configToPush.telegram) configToPush.telegram.botToken = "";
        if (configToPush.whatsapp) configToPush.whatsapp.accessToken = "";
        if (configToPush.sms) configToPush.sms.authToken = "";
        if (configToPush.googleConfig) configToPush.googleConfig.serviceAccountKeyJson = "";

        const content = Buffer.from(JSON.stringify(configToPush, null, 2)).toString('base64');

        // 3. Push (PUT)
        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${ghConfig.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'EventPlatform-Backend',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update config via Admin Portal (${new Date().toISOString()})`,
                content: content,
                sha: sha
            })
        });

        if (!putRes.ok) {
            const errText = await putRes.text();
            throw new Error(`GitHub Push Failed: ${errText}`);
        }

        const result = await putRes.json();
        res.json({ success: true, commit: result.commit.sha });

    } catch (e) {
        console.error("Push Error:", e);
        res.status(500).json({ error: (e as Error).message });
    }
});

// Generic Data Access (Protected)
app.get('/api/data/:table', authenticateToken, async (req, res) => {
    try {
        const data = await db.findAll(req.params.table);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

app.post('/api/data/:table', authenticateToken, async (req, res) => {
    try {
        const item = req.body;
        if (item.id) {
            const existing = await db.findOne(req.params.table, i => i.id === item.id);
            if (existing) {
                const updated = await db.update(req.params.table, item.id, item);
                return res.json(updated);
            }
        }
        const created = await db.insert(req.params.table, item);
        res.json(created);
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

app.delete('/api/data/:table/:id', authenticateToken, async (req, res) => {
    try {
        await db.remove(req.params.table, req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

// Sync Endpoint (Full DB Dump)
app.get('/api/sync', authenticateToken, async (req, res) => {
    try {
        const dump: Record<string, any[]> = {};
        for (const table of ALLOWED_TABLES) {
            dump[table] = await db.findAll(table);
        }
        res.json(dump);
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

// File Upload
const upload = multer({ dest: UPLOADS_DIR });
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ id: req.file.filename, url });
});

// AI Research
app.post('/api/admin/ai/research', authenticateToken, async (req, res) => {
    try {
        const { type, name } = req.body;
        const result = await researchEntity(type, name);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

// Wallet Balance
app.get('/api/delegate/wallet', authenticateToken, async (req: AuthRequest, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
        const balance = await calculateBalance(req.user.id);
        const events = await db.findAll('events');
        const config = getSafeConfig(events[0]?.config);
        res.json({ balance, currencyName: config.eventCoin.name });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

// Wallet Transfer
app.post('/api/delegate/wallet/transfer', authenticateToken, async (req: AuthRequest, res) => {
    if (!req.user) return res.sendStatus(401);
    const { recipientEmail, amount, message } = req.body;
    try {
        const senderBalance = await calculateBalance(req.user.id);
        if (senderBalance < amount) return res.status(400).json({ error: 'Insufficient funds' });

        const recipients = await db.findAll('registrations', r => r.email === recipientEmail);
        const recipient = recipients[0];
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

        const tx = {
            id: `tx_${Date.now()}`,
            fromId: req.user.id,
            toId: recipient.id,
            fromName: req.user.email, // simplified
            toName: recipient.name,
            fromEmail: req.user.email,
            toEmail: recipient.email,
            amount,
            type: 'p2p',
            message,
            timestamp: Date.now()
        };
        
        await db.insert('transactions', tx);
        res.json({ success: true, transaction: tx });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

// Payment Intent
app.post('/api/payments/create-intent', authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        // Mock Stripe for now
        res.json({ clientSecret: `mock_secret_${Date.now()}` });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

// Dashboard Stats
app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
    try {
        const registrations = await db.findAll('registrations');
        const transactions = await db.findAll('transactions');
        const tasks = await db.findAll('tasks');
        const events = await db.findAll('events');
        const config = getSafeConfig(events[0]?.config);

        const stats = {
            totalRegistrations: registrations.length,
            maxAttendees: config.event.maxAttendees || 500,
            eventDate: config.event.date,
            registrationTrend: [], // Calculate if needed
            taskStats: {
                total: tasks.length,
                completed: tasks.filter((t: any) => t.status === 'completed').length,
                pending: tasks.filter((t: any) => t.status !== 'completed').length
            },
            recentRegistrations: registrations.slice(-5).reverse(),
            eventCoinName: config.eventCoin.name,
            eventCoinCirculation: transactions.reduce((acc: number, tx: any) => acc + (tx.fromId === 'system' ? tx.amount : 0), 0),
            activeWallets: new Set(transactions.map((t: any) => t.fromId).concat(transactions.map((t: any) => t.toId))).size,
            totalTransactions: transactions.length
        };
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

// Broadcast
app.post('/api/admin/communications/broadcast', authenticateToken, async (req, res) => {
    const { subject, body, target, channel } = req.body;
    
    // Simulate sending
    console.log(`[Broadcast] Sending to ${target} via ${channel}: ${subject}`);
    await db.insert('email_logs', {
        id: `log_${Date.now()}`,
        to: target,
        subject: `[${channel.toUpperCase()}] ${subject}`,
        body,
        status: 'sent',
        timestamp: Date.now()
    });
    
    res.json({ success: true, message: `Broadcast queued for ${target} recipients.` });
});

// Server Start
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});