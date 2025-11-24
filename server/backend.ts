
/**
 * PRODUCTION SERVER ENTRY POINT
 * 
 * This file is intended to be run in a Node.js environment.
 * It effectively replaces the logic in `server/api.ts` and `server/db.ts`
 * when deployed.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';

// Fix for missing Node.js types in frontend-focused environment
declare var require: any;
declare var module: any;
declare var Buffer: any; 
declare var process: any; 

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const TICKET_SECRET = process.env.TICKET_SECRET || 'ticket-signing-secret-key';
const SERVER_API_KEY = process.env.SERVER_API_KEY || 'pk_live_12345_generated_secret_key'; 
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

const IS_PROD = process.env.NODE_ENV === 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Initialize Stripe
const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-01-27.acacia' as any, // Use latest API version
});

// --- Middleware ---
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
}) as any);
app.use(express.json({ limit: '50mb' }) as any);
app.use(cookieParser() as any);

// Serve Uploaded Files
const UPLOADS_DIR = path.join((process as any).cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: IS_PROD ? { rejectUnauthorized: false } : false
});

// AI Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || 'missing_key' });

// --- Helper Functions ---
const query = async (text: string, params?: any[]) => pool.query(text, params);
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

// Auth Middleware
const authenticate = (req: any, res: any, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === SERVER_API_KEY) {
        req.user = { id: 'system_api', email: 'api@system', type: 'admin', permissions: ['view_dashboard'] }; // Simplified super admin
        return next();
    }
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// --- API ROUTES ---

// Health Check
app.get('/api/health', async (req: any, res: any) => {
    try {
        await query('SELECT 1');
        res.json({ status: 'ok' });
    } catch (e) {
        res.status(503).json({ status: 'error' });
    }
});

// === PAYMENTS (STRIPE) ===
app.post('/api/create-payment-intent', authenticate, async (req: any, res: any) => {
    try {
        const { amount, currency = 'usd' } = req.body;
        
        // Basic validation
        if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects cents
            currency: currency,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                userId: req.user.id,
                email: req.user.email
            }
        });

        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
});

// === EVENTS ===
app.get('/api/events', async (req: any, res: any) => {
    const result = await query('SELECT id, name, config FROM events');
    res.json(result.rows.map(row => ({
        id: row.id,
        name: row.config.event.name,
        date: row.config.event.date,
        location: row.config.event.location,
        logoUrl: row.config.theme.logoUrl,
        colorPrimary: row.config.theme.colorPrimary
    })));
});

app.get('/api/events/:id', async (req: any, res: any) => {
    const { id } = req.params;
    const eventRes = await query('SELECT config FROM events WHERE id = $1', [id]);
    if (eventRes.rows.length === 0) return res.status(404).json({ message: 'Event not found' });
    
    const regCount = await query('SELECT COUNT(*) FROM registrations WHERE event_id = $1', [id]);
    const sessions = await query('SELECT * FROM sessions WHERE event_id = $1', [id]);
    const speakers = await query('SELECT * FROM speakers WHERE event_id = $1', [id]);
    const sponsors = await query('SELECT * FROM sponsors WHERE event_id = $1', [id]);
    
    // Convert snake_case DB to camelCase for frontend
    const mapKeys = (obj: any) => {
        const newObj: any = {};
        for (const key in obj) {
            const camel = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            newObj[camel] = obj[key];
        }
        return newObj;
    };

    res.json({ 
        config: eventRes.rows[0].config, 
        registrationCount: parseInt(regCount.rows[0].count, 10),
        sessions: sessions.rows.map(mapKeys),
        speakers: speakers.rows.map(mapKeys),
        sponsors: sponsors.rows.map(mapKeys)
    });
});

app.post('/api/events', authenticate, async (req: any, res: any) => {
    const { name, type } = req.body;
    const id = generateId('evt');
    // Default config
    const config = { event: { name, eventType: type, date: 'TBD', location: 'TBD' }, theme: { colorPrimary: '#4f46e5' } };
    await query('INSERT INTO events (id, name, config, created_at) VALUES ($1, $2, $3, $4)', [id, name, JSON.stringify(config), Date.now()]);
    res.json({ id, name, config });
});

// === REGISTRATIONS ===
app.get('/api/admin/registrations', authenticate, async (req: any, res: any) => {
    const result = await query('SELECT * FROM registrations'); 
    const regs = result.rows.map(r => ({ 
        ...r, 
        ...r.custom_fields,
        createdAt: parseInt(r.created_at),
        checkedIn: r.checked_in 
    }));
    res.json(regs);
});

app.post('/api/registrations', async (req: any, res: any) => {
    const { eventId, data, inviteToken } = req.body;
    // Check duplication
    const exist = await query('SELECT id FROM registrations WHERE email = $1 AND event_id = $2', [data.email, eventId]);
    if (exist.rows.length > 0) return res.json({ success: false, message: 'Email already registered.' });

    const id = generateId('reg');
    const hash = await bcrypt.hash(data.password || 'default', 10);
    const { name, email, ...custom } = data;
    
    await query('INSERT INTO registrations (id, event_id, name, email, password_hash, custom_fields, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, eventId, name, email, hash, JSON.stringify(custom), Date.now()]
    );
    
    if (inviteToken) await query('DELETE FROM invite_tokens WHERE token = $1', [inviteToken]);
    
    res.json({ success: true, message: 'Registered successfully.' });
});

app.put('/api/admin/registrations/:id/status', authenticate, async (req: any, res: any) => {
    const { checkedIn } = req.body;
    await query('UPDATE registrations SET checked_in = $1 WHERE id = $2', [checkedIn, req.params.id]);
    res.json({ success: true });
});

app.put('/api/admin/registrations/:id', authenticate, async (req: any, res: any) => {
    const { data } = req.body;
    // Update fields conditionally
    if (data.name) await query('UPDATE registrations SET name = $1 WHERE id = $2', [data.name, req.params.id]);
    if (data.email) await query('UPDATE registrations SET email = $1 WHERE id = $2', [data.email, req.params.id]);
    if (data.customFields) await query('UPDATE registrations SET custom_fields = $1 WHERE id = $2', [JSON.stringify(data.customFields), req.params.id]);
    res.json({ success: true });
});

app.delete('/api/admin/registrations/:id', authenticate, async (req: any, res: any) => {
    await query('DELETE FROM registrations WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// === CONFIG ===
app.put('/api/admin/config', authenticate, async (req: any, res: any) => {
    const { config } = req.body;
    // Update the first/main event for now
    await query('UPDATE events SET config = $1 WHERE id = $2', [JSON.stringify(config), 'main-event']);
    res.json(config);
});

// === TASKS ===
app.get('/api/tasks', authenticate, async (req: any, res: any) => {
    const result = await query('SELECT * FROM tasks');
    res.json(result.rows.map(r => ({ 
        ...r, 
        assigneeEmail: r.assignee_email, 
        dueDate: r.due_date,
        eventId: r.event_id
    })));
});

app.post('/api/tasks', authenticate, async (req: any, res: any) => {
    const task = req.body;
    if (task.id) {
        await query('UPDATE tasks SET title=$1, description=$2, status=$3, priority=$4, due_date=$5, assignee_email=$6 WHERE id=$7',
            [task.title, task.description, task.status, task.priority, task.dueDate, task.assigneeEmail, task.id]);
    } else {
        const id = generateId('task');
        await query('INSERT INTO tasks (id, event_id, title, description, status, priority, due_date, assignee_email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [id, task.eventId || 'main-event', task.title, task.description, task.status, task.priority, task.dueDate, task.assigneeEmail]);
    }
    res.json({ success: true });
});

app.delete('/api/tasks/:id', authenticate, async (req: any, res: any) => {
    await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// === ADMIN USERS & ROLES ===
app.get('/api/admin/users', authenticate, async (req: any, res: any) => {
    const result = await query('SELECT id, email, role_id as "roleId" FROM admin_users');
    res.json(result.rows);
});

app.post('/api/admin/users', authenticate, async (req: any, res: any) => {
    const user = req.body;
    if (user.id) {
        await query('UPDATE admin_users SET role_id = $1 WHERE id = $2', [user.roleId, user.id]);
    } else {
        const id = generateId('usr');
        const hash = await bcrypt.hash(user.password, 10);
        await query('INSERT INTO admin_users (id, email, password_hash, role_id, created_at) VALUES ($1, $2, $3, $4, $5)',
            [id, user.email, hash, user.roleId, Date.now()]);
    }
    res.json({ success: true });
});

app.delete('/api/admin/users/:id', authenticate, async (req: any, res: any) => {
    await query('DELETE FROM admin_users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

app.get('/api/admin/roles', authenticate, async (req: any, res: any) => {
    const result = await query('SELECT * FROM roles');
    res.json(result.rows);
});

app.post('/api/admin/roles', authenticate, async (req: any, res: any) => {
    const role = req.body;
    if (role.id) {
        await query('UPDATE roles SET name=$1, description=$2, permissions=$3 WHERE id=$4',
            [role.name, role.description, role.permissions, role.id]);
    } else {
        const id = generateId('role');
        await query('INSERT INTO roles (id, name, description, permissions) VALUES ($1, $2, $3, $4)',
            [id, role.name, role.description, role.permissions]);
    }
    res.json({ success: true });
});

// === SESSIONS, SPEAKERS, SPONSORS (Generalized CRUD) ===
const handleCrud = (table: string, fields: string[]) => {
    app.get(`/api/${table}`, async (req: any, res: any) => {
        const r = await query(`SELECT * FROM ${table}`);
        // Simple camelCase conversion
        const mapped = r.rows.map(row => {
            const obj: any = {};
            Object.keys(row).forEach(k => {
                const camel = k.replace(/_([a-z])/g, g => g[1].toUpperCase());
                obj[camel] = row[k];
            });
            return obj;
        });
        res.json(mapped);
    });
    
    app.post(`/api/${table}`, authenticate, async (req: any, res: any) => {
        const data = req.body;
        if (data.id && !data.id.startsWith('temp_')) { // Update
            // Dynamic Update Query
            const sets = fields.map((f, i) => {
                const dbField = f.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                return `${dbField} = $${i + 1}`;
            }).join(', ');
            const values = fields.map(f => data[f]);
            await query(`UPDATE ${table} SET ${sets} WHERE id = $${fields.length + 1}`, [...values, data.id]);
        } else { // Insert
            const id = generateId(table.substring(0,3));
            const cols = ['id', 'event_id', ...fields.map(f => f.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`))].join(', ');
            const placeholders = fields.map((_, i) => `$${i + 3}`).join(', ');
            const values = fields.map(f => data[f]);
            await query(`INSERT INTO ${table} (${cols}) VALUES ($1, $2, ${placeholders})`, [id, 'main-event', ...values]);
        }
        res.json({ success: true });
    });

    app.delete(`/api/${table}/:id`, authenticate, async (req: any, res: any) => {
        await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    });
};

handleCrud('sessions', ['title', 'description', 'startTime', 'endTime', 'location', 'track', 'capacity', 'speakerIds']);
handleCrud('speakers', ['name', 'title', 'company', 'bio', 'photoUrl', 'linkedinUrl', 'twitterUrl']);
handleCrud('sponsors', ['name', 'description', 'websiteUrl', 'logoUrl', 'tier']);
handleCrud('meal_plans', ['name', 'description', 'dailyCost']);
handleCrud('restaurants', ['name', 'cuisine', 'operatingHours', 'menu']);

// === DINING ===
app.get('/api/dining/reservations', authenticate, async (req: any, res: any) => {
    const r = await query('SELECT * FROM dining_reservations');
    res.json(r.rows.map(row => ({ 
        id: row.id, 
        restaurantId: row.restaurant_id, 
        delegateId: row.delegate_id, 
        reservationTime: row.reservation_time, 
        partySize: row.party_size 
    })));
});
app.post('/api/dining/reservations', authenticate, async (req: any, res: any) => {
    const d = req.body;
    await query('INSERT INTO dining_reservations (id, restaurant_id, delegate_id, reservation_time, party_size) VALUES ($1, $2, $3, $4, $5)',
        [generateId('res'), d.restaurantId, d.delegateId, d.reservationTime, d.partySize]);
    res.json({ success: true });
});
app.delete('/api/dining/reservations/:id', authenticate, async (req: any, res: any) => {
    await query('DELETE FROM dining_reservations WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// === MEDIA (Base64 Upload) ===
app.get('/api/media', authenticate, async (req: any, res: any) => {
    const r = await query('SELECT * FROM media');
    res.json(r.rows.map(row => ({ ...row, uploadedAt: parseInt(row.uploaded_at) })));
});

app.post('/api/media', authenticate, async (req: any, res: any) => {
    // Expects { name, type, size, base64 } in body (JSON)
    // We set a high JSON limit in middleware to handle this
    const { name, type, size, base64 } = req.body;
    const id = generateId('file');
    await query('INSERT INTO media (id, name, type, size, url, uploaded_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, name, type, size, base64, Date.now()]);
    res.json({ id, url: base64 });
});

app.delete('/api/media/:id', authenticate, async (req: any, res: any) => {
    await query('DELETE FROM media WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// === DASHBOARD STATS ===
app.get('/api/admin/stats', authenticate, async (req: any, res: any) => {
    const regCount = await query('SELECT COUNT(*) FROM registrations');
    const taskCount = await query('SELECT status, COUNT(*) FROM tasks GROUP BY status');
    const txRes = await query('SELECT SUM(amount) as circulation FROM transactions WHERE type IN (\'initial\', \'purchase\', \'reward\')');
    const latestRegs = await query('SELECT * FROM registrations ORDER BY created_at DESC LIMIT 5');
    
    const taskStats = { total: 0, completed: 0, pending: 0 };
    taskCount.rows.forEach((r: any) => {
        const count = parseInt(r.count);
        taskStats.total += count;
        if (r.status === 'completed') taskStats.completed += count;
        else taskStats.pending += count;
    });

    res.json({
        totalRegistrations: parseInt(regCount.rows[0].count),
        maxAttendees: 500, // from config ideally
        eventCoinCirculation: parseFloat(txRes.rows[0].circulation || '0'),
        taskStats,
        recentRegistrations: latestRegs.rows.map(r => ({...r, createdAt: parseInt(r.created_at), checkedIn: r.checked_in})),
        registrationTrend: [], // Simplified
        eventDate: 'October 26, 2025',
        eventCoinName: 'EventCoin'
    });
});

// === AUTH ===
app.post('/api/login/admin', async (req: any, res: any) => {
    const { email, password } = req.body;
    const r = await query('SELECT * FROM admin_users WHERE email = $1', [email]);
    const user = r.rows[0];
    if (user && await bcrypt.compare(password, user.password_hash)) {
        const roleRes = await query('SELECT permissions FROM roles WHERE id = $1', [user.role_id]);
        const perms = roleRes.rows[0]?.permissions || [];
        const token = jwt.sign({ id: user.id, email, permissions: perms, type: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('token', token, { httpOnly: true });
        res.json({ token, user: { id: user.id, email, permissions: perms } });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

app.post('/api/logout', (req: any, res: any) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// Start Server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
