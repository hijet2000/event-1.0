
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
import * as gemini from './geminiService';
import { Buffer } from 'buffer';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { fileURLToPath } from 'url';
// Fix: Added missing types import
import { RegistrationData } from '../types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const JWT_SECRET = process.env.JWT_SECRET || 'edge_platform_secret_2025';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2024-12-18.acacia' as any,
    typescript: true
});

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Fix: Defined upload instance for multer
const upload = multer({ dest: UPLOADS_DIR });

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: false }));
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

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
            this.pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
            this.pool.query('SELECT NOW()').then(() => { this.usePostgres = true; this.ensureTables(); }).catch(() => { this.usePostgres = false; });
        }
    }

    private async ensureTables() {
        if (!this.pool) return;
        for (const table of ALLOWED_TABLES) {
            await this.pool.query(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, data JSONB);`);
        }
    }

    private loadMemoryDb() {
        try { if (fs.existsSync(DATA_FILE)) { const data = fs.readFileSync(DATA_FILE, 'utf-8'); this.memoryDb = { ...this.memoryDb, ...JSON.parse(data) }; } } catch (e) {}
    }

    private saveMemoryDb() {
        try { fs.writeFileSync(DATA_FILE, JSON.stringify(this.memoryDb, null, 2)); } catch (e) {}
    }

    async findAll(table: string, predicate?: (item: any) => boolean) {
        if (this.usePostgres && this.pool) {
            try {
                const res = await this.pool.query(`SELECT data FROM ${table}`);
                const items = res.rows.map(row => row.data);
                return predicate ? items.filter(predicate) : items;
            } catch (e) {}
        }
        const items = this.memoryDb[table] || [];
        return predicate ? items.filter(predicate) : items;
    }

    async findOne(table: string, predicate: (item: any) => boolean) {
        const items = await this.findAll(table, predicate);
        return items.length > 0 ? items[0] : null;
    }

    async insert(table: string, item: any) {
        if (this.usePostgres && this.pool) {
            try { await this.pool.query(`INSERT INTO ${table} (id, data) VALUES ($1, $2)`, [item.id, item]); return item; } catch (e) {}
        }
        if (!this.memoryDb[table]) this.memoryDb[table] = [];
        this.memoryDb[table].push(item);
        this.saveMemoryDb();
        return item;
    }

    async update(table: string, id: string, updates: any) {
        if (this.usePostgres && this.pool) {
            try {
                const existingRes = await this.pool.query(`SELECT data FROM ${table} WHERE id = $1`, [id]);
                if (existingRes.rows.length === 0) return null;
                const newItem = { ...existingRes.rows[0].data, ...updates };
                await this.pool.query(`UPDATE ${table} SET data = $1 WHERE id = $2`, [newItem, id]);
                return newItem;
            } catch (e) {}
        }
        const list = this.memoryDb[table] || [];
        const index = list.findIndex(i => i.id === id);
        if (index !== -1) { this.memoryDb[table][index] = { ...list[index], ...updates }; this.saveMemoryDb(); return this.memoryDb[table][index]; }
        return null;
    }

    async remove(table: string, id: string) {
        if (this.usePostgres && this.pool) {
            try { await this.pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]); return true; } catch (e) {}
        }
        const initialLen = (this.memoryDb[table] || []).length;
        this.memoryDb[table] = (this.memoryDb[table] || []).filter(i => i.id !== id);
        if (this.memoryDb[table].length < initialLen) { this.saveMemoryDb(); return true; }
        return false;
    }
}

const db = new DatabaseService();

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    // Fix: Using (req as any).headers to avoid TS indexing error on custom interface
    const authHeader = (req as any).headers['authorization'];
    const token = typeof authHeader === 'string' ? authHeader.split(' ')[1] : undefined;
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const sendConfirmationEmail = async (to: string, subject: string, body: string) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.ethereal.email',
            port: parseInt(process.env.SMTP_PORT || '587'),
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({ from: '"Event Platform" <noreply@event.com>', to, subject, text: body, html: body.replace(/\n/g, '<br>') });
    } catch (e) { console.error("Email failed:", e); }
};

// --- API Routes ---

app.post('/api/auth/admin/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await db.findOne('admin_users', u => u.email === email);
    if (user && await bcrypt.compare(password, user.password_hash)) {
        const role = await db.findOne('roles', r => r.id === user.roleId);
        const token = jwt.sign({ id: user.id, email: user.email, type: 'admin', permissions: role?.permissions || [] }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { ...user, permissions: role?.permissions || [], password_hash: undefined } });
    } else res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/register', async (req, res) => {
    const { eventId, email, name, goals, password } = req.body;
    const existing = await db.findOne('registrations', r => r.email === email && r.eventId === eventId);
    if (existing) return res.status(400).json({ error: 'Already registered' });

    // Fix: Type status correctly as a constant to match RegistrationData interface
    const newUser: RegistrationData = {
        id: `reg_${Date.now()}`, eventId, email, name, goals,
        status: 'confirmed' as const, checkedIn: false, createdAt: Date.now(),
        password_hash: password ? await bcrypt.hash(password, 10) : undefined
    } as RegistrationData;
    await db.insert('registrations', newUser);

    const config = (await db.findOne('events', e => e.id === eventId))?.config || {};
    try {
        const emailContent = await gemini.generateRegistrationEmails(newUser, config, '', '');
        await sendConfirmationEmail(email, emailContent.userEmail.subject, emailContent.userEmail.body);
    } catch (e) {}

    res.json({ success: true, user: newUser });
});

// Generic Data Routes for Admin
app.get('/api/data/:table', authenticateToken, async (req, res) => {
    if (!ALLOWED_TABLES.includes(req.params.table)) return res.status(400).json({ error: 'Invalid table' });
    res.json(await db.findAll(req.params.table));
});

app.get('/api/data/:table/:id', authenticateToken, async (req, res) => {
    const item = await db.findOne(req.params.table, i => i.id === req.params.id);
    item ? res.json(item) : res.status(404).json({ error: 'Not found' });
});

app.post('/api/data/:table', authenticateToken, async (req, res) => {
    const item = { ...req.body, id: req.body.id || `${req.params.table}_${Date.now()}` };
    res.json(await db.insert(req.params.table, item));
});

app.put('/api/data/:table/:id', authenticateToken, async (req, res) => {
    const item = await db.update(req.params.table, req.params.id, req.body);
    item ? res.json(item) : res.status(404).json({ error: 'Not found' });
});

app.delete('/api/data/:table/:id', authenticateToken, async (req, res) => {
    const success = await db.remove(req.params.table, req.params.id);
    res.json({ success });
});

// Public Routes
app.get('/api/public/events', async (req, res) => res.json(await db.findAll('events')));
app.get('/api/public/event/:id', async (req, res) => {
    const event = await db.findOne('events', e => e.id === req.params.id);
    if (!event) return res.status(404).json({ error: 'Not found' });
    const count = (await db.findAll('registrations', r => r.eventId === req.params.id)).length;
    res.json({ config: event.config, registrationCount: count, sessions: await db.findAll('sessions', s => s.eventId === req.params.id), speakers: await db.findAll('speakers'), sponsors: await db.findAll('sponsors'), ticketTiers: await db.findAll('ticket_tiers') });
});

// AI & Specialized Tools
app.post('/api/ai/research', authenticateToken, async (req, res) => {
    const data = await gemini.researchEntity(req.body.type, req.body.name);
    res.json(data);
});

app.post('/api/ai/help', authenticateToken, async (req, res) => {
    const answer = await gemini.askSystemHelp(req.body.query);
    res.json({ answer });
});

app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ id: req.file.filename, url: `/uploads/${req.file.filename}` });
});

const staticPath = path.join(__dirname, process.env.NODE_ENV === 'production' ? '../../dist' : '../dist');
app.use(express.static(staticPath));
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API not found' });
    const indexHtml = path.join(staticPath, 'index.html');
    fs.existsSync(indexHtml) ? res.sendFile(indexHtml) : res.status(404).send('Frontend not found');
});

httpServer.listen(PORT, () => console.log(`🚀 Production backend running on port ${PORT}`));
