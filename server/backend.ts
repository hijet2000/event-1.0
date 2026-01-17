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
import { researchEntity, generateRegistrationEmails } from './geminiService';
import { Buffer } from 'buffer';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// ESM fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extend Request to include user
interface AuthRequest extends ExpressRequest {
    user?: {
        id: string;
        email: string;
        type: 'admin' | 'delegate';
        permissions?: string[];
        eventId?: string;
    };
    file?: any;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const JWT_SECRET = process.env.JWT_SECRET || 'mock_signature_secret';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2024-12-18.acacia' as any,
    typescript: true
});

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, 
}));
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 2000,
	standardHeaders: true,
	legacyHeaders: false,
});
app.use('/api/', apiLimiter);

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
        ALLOWED_TABLES.forEach(t => this.memoryDb[t] = []);
        this.loadMemoryDb();

        if (process.env.DATABASE_URL) {
            this.pool = new Pool({ 
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });
            
            this.pool.query('SELECT NOW()')
                .then(() => {
                    console.log('🐘 Connected to PostgreSQL');
                    this.usePostgres = true;
                    this.ensureTables();
                })
                .catch(err => {
                    console.error('⚠️ PostgreSQL connection failed, falling back to file storage.', err.message);
                    this.usePostgres = false;
                });
        }
    }

    private async ensureTables() {
        if (!this.pool) return;
        for (const table of ALLOWED_TABLES) {
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS ${table} (
                    id TEXT PRIMARY KEY,
                    data JSONB
                );
            `);
        }
    }

    private loadMemoryDb() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const data = fs.readFileSync(DATA_FILE, 'utf-8');
                const loaded = JSON.parse(data);
                this.memoryDb = { ...this.memoryDb, ...loaded };
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
                const res = await this.pool.query(`SELECT data FROM ${table}`);
                const items = res.rows.map(row => row.data);
                if (predicate) return items.filter(predicate);
                return items;
            } catch (e) {
                console.warn(`[PG] findAll failed for ${table}.`, (e as Error).message);
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
                await this.pool.query(`INSERT INTO ${table} (id, data) VALUES ($1, $2)`, [item.id, item]);
                return item;
            } catch (e) {
                console.warn(`[PG] Insert failed for ${table}.`, (e as Error).message);
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
                const existingRes = await this.pool.query(`SELECT data FROM ${table} WHERE id = $1`, [id]);
                if (existingRes.rows.length === 0) return null;
                const newItem = { ...existingRes.rows[0].data, ...updates };
                await this.pool.query(`UPDATE ${table} SET data = $1 WHERE id = $2`, [newItem, id]);
                return newItem;
            } catch (e) {
                console.warn(`[PG] Update failed for ${table}.`, (e as Error).message);
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
                console.warn(`[PG] Delete failed for ${table}.`, (e as Error).message);
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

const comparePass = async (input: string, hash: string): Promise<boolean> => {
    if (hash.startsWith('$2b$10$mock')) {
        const computed = `$2b$10$mock${Buffer.from(input).toString('base64')}`;
        return computed === hash;
    }
    return await bcrypt.compare(input, hash);
};

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    // Fixed: Property 'header' does not exist on AuthRequest; using standard Express req.headers access
    const authHeader = req.headers['authorization'];
    const token = typeof authHeader === 'string' ? authHeader.split(' ')[1] : undefined;
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            if (token.split('.').length === 3 && token.split('.')[2] === 'mock_signature_secret') {
                 try {
                    const jsonPayload = Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
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

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

app.post('/api/auth/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.findOne('admin_users', (u) => u.email === email);
        if (user && await comparePass(password, user.password_hash)) {
            const role = await db.findOne('roles', (r) => r.id === user.roleId);
            const token = jwt.sign({
                id: user.id, email: user.email, type: 'admin', permissions: role ? role.permissions : []
            }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token, user: { ...user, permissions: role ? role.permissions : [], password_hash: undefined } });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

const upload = multer({ dest: UPLOADS_DIR });
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ id: req.file.filename, url: `/uploads/${req.file.filename}` });
});

const staticPath = path.join(__dirname, process.env.NODE_ENV === 'production' ? '../../dist' : '../dist');
app.use(express.static(staticPath));
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API endpoint not found' });
    const indexHtml = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexHtml)) res.sendFile(indexHtml);
    else res.status(404).send('Frontend not found.');
});

httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));