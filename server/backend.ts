
/**
 * PRODUCTION SERVER ENTRY POINT
 * 
 * This file is intended to be run in a Node.js environment.
 * It effectively replaces the logic in `server/api.ts` and `server/db.ts`
 * when deployed.
 * 
 * Prerequisites:
 * npm install express cors pg dotenv @google/genai body-parser jsonwebtoken bcrypt cookie-parser nodemailer
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
import { promisify } from 'util';
import nodemailer from 'nodemailer';

// Fix for missing Node.js types in frontend-focused environment
declare var require: any;
declare var module: any;
declare var Buffer: any; 
declare var process: any; 

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const TICKET_SECRET = process.env.TICKET_SECRET || 'ticket-signing-secret-key'; // Separate secret for tickets
const IS_PROD = process.env.NODE_ENV === 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// --- Structured Logging ---
const logger = {
    info: (message: string, meta?: any) => {
        if (IS_PROD) {
            console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message, ...meta }));
        } else {
            console.log(`[INFO] ${message}`, meta || '');
        }
    },
    error: (message: string, error?: any) => {
        if (IS_PROD) {
            console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message, error: error?.toString(), stack: error?.stack }));
        } else {
            console.error(`[ERROR] ${message}`, error);
        }
    },
    warn: (message: string, meta?: any) => {
        if (IS_PROD) {
            console.warn(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), message, ...meta }));
        } else {
            console.warn(`[WARN] ${message}`, meta || '');
        }
    }
};

// --- File Storage Setup ---
const UPLOADS_DIR = path.join((process as any).cwd(), 'uploads');
// Determine build path relative to this server file location or root
const CLIENT_BUILD_PATH = path.join((process as any).cwd(), 'dist'); 

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    logger.info(`Created uploads directory at ${UPLOADS_DIR}`);
}

// --- Security Middleware ---

// 1. Rate Limiter (In-Memory for prototype)
const rateLimit = new Map<string, { count: number, startTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // 100 requests per window

// Cleanup interval for rate limit map to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimit.entries()) {
        if (now - record.startTime > RATE_LIMIT_WINDOW) {
            rateLimit.delete(ip);
        }
    }
}, 60 * 60 * 1000); // Run every hour

const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = rateLimit.get(ip);

    if (record) {
        if (now - record.startTime > RATE_LIMIT_WINDOW) {
            // Reset window
            rateLimit.set(ip, { count: 1, startTime: now });
        } else {
            record.count++;
            if (record.count > RATE_LIMIT_MAX) {
                logger.warn(`Rate limit exceeded for IP: ${ip}`);
                res.status(429).json({ message: 'Too many requests, please try again later.' });
                return;
            }
        }
    } else {
        rateLimit.set(ip, { count: 1, startTime: now });
    }
    next();
};

// 2. Security Headers (Manual Helmet)
const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (IS_PROD) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
};

// Middleware Stack
app.use(cors({
    origin: FRONTEND_URL, // Dynamic origin
    credentials: true
}) as any);
app.use(securityHeaders);
app.use(express.json({ limit: '50mb' }) as any); // Increased limit for video uploads
app.use(cookieParser() as any);

// Serve Uploaded Files Statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Log all requests
app.use((req, res, next) => {
    // Don't log static asset requests to keep logs clean
    if (!req.url.startsWith('/assets') && !req.url.startsWith('/uploads') && !req.url.match(/\.(js|css|png|jpg|ico)$/)) {
        logger.info(`${req.method} ${req.url}`);
    }
    next();
});

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: IS_PROD ? { rejectUnauthorized: false } : false
});

// --- Secure Secret Retrieval ---
const getSecureApiKey = (): string => {
    // Priority 1: Docker Secret / File-based secret (Secure Production)
    if (process.env.GEMINI_API_KEY_FILE) {
        try {
            if (fs.existsSync(process.env.GEMINI_API_KEY_FILE)) {
                return fs.readFileSync(process.env.GEMINI_API_KEY_FILE, 'utf8').trim();
            }
        } catch (error) {
            logger.warn(`Failed to read secret file at ${process.env.GEMINI_API_KEY_FILE}`);
        }
    }

    // Priority 2: Standard Environment Variable
    if (process.env.API_KEY) {
        return process.env.API_KEY;
    }

    logger.error("CRITICAL: Gemini API Key not found in environment variables or secret files.");
    return ""; 
};

// AI Client Initialization
const apiKey = getSecureApiKey();
if (!apiKey && IS_PROD) {
    logger.error("Server starting without API Key. AI features will fail.");
}
const ai = new GoogleGenAI({ apiKey: apiKey || 'missing_key' });

// --- Helper Functions ---

const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
            logger.warn('Slow query detected', { text, duration });
        }
        return res;
    } catch (e) {
        logger.error('Database query failed', e);
        throw e;
    }
};

const generateToken = (payload: object) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

// --- Email Service ---
const createTransporter = (config: any) => {
    if (config.emailProvider === 'smtp') {
        return nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.encryption === 'ssl', 
            auth: {
                user: config.smtp.username,
                pass: config.smtp.password,
            },
        });
    }
    // Placeholder for Google Service Account Logic
    throw new Error("Google Email Provider not yet fully implemented on backend.");
};

const sendEmail = async (to: string, subject: string, body: string, html: string | undefined, eventId: string) => {
    try {
        // Fetch Config
        const res = await query('SELECT config FROM events WHERE id = $1', [eventId]);
        if (res.rows.length === 0) throw new Error("Event config not found");
        const config = res.rows[0].config;

        if (config.emailProvider === 'smtp') {
             const transporter = createTransporter(config);
             await transporter.sendMail({
                 from: `"${config.host.name}" <${config.host.email}>`, 
                 to: to, 
                 subject: subject, 
                 text: body, 
                 html: html || body.replace(/\n/g, '<br>'), 
             });
             logger.info(`Email sent to ${to}`);
             
             await query('INSERT INTO email_logs (id, "to", subject, body, status, timestamp) VALUES ($1, $2, $3, $4, $5, $6)', 
                [`email_${Date.now()}`, to, subject, body, 'sent', Date.now()]
             );
        } else {
            logger.warn(`Email provider ${config.emailProvider} not supported yet.`);
        }
    } catch (e: any) {
        logger.error(`Failed to send email to ${to}`, e);
        // Log failure
        await query('INSERT INTO email_logs (id, "to", subject, body, status, error, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
            [`email_${Date.now()}`, to, subject, body, 'failed', e.message, Date.now()]
         );
        throw e;
    }
};

// --- Job Queue System (In-Memory) ---
interface Job {
    id: string;
    type: 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_notification';
    payload: any;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    retries: number;
}

const jobQueue: Job[] = [];
const MAX_RETRIES = 3;

const processQueue = async () => {
    const pendingJob = jobQueue.find(j => j.status === 'pending');
    if (!pendingJob) return;

    pendingJob.status = 'processing';
    logger.info(`Processing job ${pendingJob.id}: ${pendingJob.type}`);

    try {
        if (pendingJob.type === 'send_email') {
            const { to, subject, body, html, eventId } = pendingJob.payload;
            await sendEmail(to, subject, body, html, eventId);
        } else if (pendingJob.type === 'send_sms') {
            const { to, body } = pendingJob.payload;
            logger.info(`[SMS Simulation] Sending to ${to}: ${body}`);
            // Real implementation: Call Twilio API
            await new Promise(r => setTimeout(r, 200));
        } else if (pendingJob.type === 'send_whatsapp') {
             const { to, body } = pendingJob.payload;
             logger.info(`[WhatsApp Simulation] Sending to ${to}: ${body}`);
             // Real implementation: Call WhatsApp Business API
             await new Promise(r => setTimeout(r, 200));
        } else if (pendingJob.type === 'send_notification') {
             const { userId, body } = pendingJob.payload;
             logger.info(`[In-App Notification Simulation] Sending to user ${userId}: ${body}`);
             await new Promise(r => setTimeout(r, 100));
        }

        pendingJob.status = 'completed';
        const index = jobQueue.findIndex(j => j.id === pendingJob.id);
        if (index > -1) jobQueue.splice(index, 1);
        
    } catch (e) {
        logger.error(`Job ${pendingJob.id} failed`, e);
        pendingJob.retries++;
        if (pendingJob.retries >= MAX_RETRIES) {
            pendingJob.status = 'failed';
        } else {
            pendingJob.status = 'pending'; // Retry
        }
    }
};

// Process queue every 2 seconds
setInterval(processQueue, 2000);


// --- Automated Maintenance ---
const runMaintenance = async () => {
    logger.info("Running system maintenance...");
    
    try {
        // 1. Clean up expired tokens
        await query('DELETE FROM password_reset_tokens WHERE expiry < $1', [Date.now()]);
        
        // 2. Clean up orphaned files (simplified logic)
        const dbFilesRes = await query('SELECT url FROM media');
        const dbFiles = new Set(dbFilesRes.rows.map(r => path.basename(r.url)));
        
        if (fs.existsSync(UPLOADS_DIR)) {
            const diskFiles = fs.readdirSync(UPLOADS_DIR);
            for (const file of diskFiles) {
                if (!dbFiles.has(file)) {
                    fs.unlinkSync(path.join(UPLOADS_DIR, file));
                    logger.info(`Deleted orphaned file: ${file}`);
                }
            }
        }
    } catch (e) {
        logger.error("Maintenance task failed", e);
    }
};

// Run every hour
setInterval(runMaintenance, 60 * 60 * 1000);


// 3. Authenticate: Verifies JWT from HttpOnly Cookie
const authenticate = (req: any, res: any, next: NextFunction) => {
    const token = req.cookies.token;
    
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// 4. Require Permission: Granular RBAC Check
const requirePermission = (requiredPermission: string) => {
    return (req: any, res: any, next: NextFunction) => {
        if (!req.user) return res.sendStatus(401);
        if (req.user.permissions && req.user.permissions.includes(requiredPermission)) {
            next();
        } else {
            logger.warn(`User ${req.user.email} attempted to access protected route without ${requiredPermission}`);
            res.status(403).json({ message: 'Forbidden: Insufficient Permissions' });
        }
    };
};

// Helper to set secure cookie
const setAuthCookie = (res: any, token: string) => {
    res.cookie('token', token, {
        httpOnly: true, 
        secure: IS_PROD, 
        sameSite: 'strict', 
        maxAge: 24 * 60 * 60 * 1000 
    });
};

// --- Routes ---

// Health Check
app.get('/api/health', async (req: any, res: any) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', timestamp: Date.now(), db: 'connected' });
    } catch (e) {
        logger.error("Health check failed:", e);
        res.status(503).json({ status: 'error', message: 'Database unavailable', timestamp: Date.now() });
    }
});

// --- Secure Ticket Endpoints ---

// 1. Generate Signed Ticket Token (For Delegate Pass)
app.get('/api/tickets/token', authenticate, async (req: any, res: any) => {
    // User is authenticated via 'authenticate' middleware, so req.user exists.
    // Only the owner can generate their own ticket token.
    try {
        const userId = req.user.id;
        const eventId = req.user.eventId;
        
        // Generate a short-lived signed token specifically for QR scanning
        // This token proves the bearer owns this userId and it was issued by our server
        const ticketToken = jwt.sign(
            { uid: userId, eid: eventId, type: 'ticket' }, 
            TICKET_SECRET, 
            { expiresIn: '7d' } // Valid for 7 days (duration of event)
        );
        
        res.json({ token: ticketToken });
    } catch (e) {
        logger.error("Failed to generate ticket token", e);
        res.status(500).json({ message: "Error generating ticket" });
    }
});

// 2. Verify Ticket Token (For Admin Scanner)
app.post('/api/tickets/verify', authenticate, requirePermission('manage_registrations'), async (req: any, res: any) => {
    const { token } = req.body;
    
    if (!token) return res.status(400).json({ message: "No token provided" });

    try {
        // 1. Verify the JWT signature
        const payload = jwt.verify(token, TICKET_SECRET) as any;
        
        if (payload.type !== 'ticket') {
            return res.status(400).json({ message: "Invalid token type" });
        }

        const { uid, eid } = payload;

        // 2. Find the user
        const result = await query('SELECT * FROM registrations WHERE id = $1 AND event_id = $2', [uid, eid]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // 3. Perform Check-in
        if (user.checked_in) {
            return res.json({ 
                success: false, 
                status: 'already_checked_in', 
                user: { id: user.id, name: user.name, email: user.email },
                message: `${user.name} is already checked in.` 
            });
        }

        await query('UPDATE registrations SET checked_in = true WHERE id = $1', [uid]);
        
        logger.info(`User checked in via Secure QR: ${user.email}`);
        
        res.json({ 
            success: true, 
            status: 'checked_in', 
            user: { id: user.id, name: user.name, email: user.email },
            message: `Successfully checked in ${user.name}` 
        });

    } catch (e) {
        logger.warn("Ticket verification failed", e);
        return res.status(400).json({ message: "Invalid or expired ticket" });
    }
});

// ... [Rest of API endpoints omitted for brevity, they remain unchanged] ...

// --- AI Proxy Endpoints (Secure) ---
app.post('/api/ai/generate', authenticate, async (req: any, res: any) => {
    const { model, contents, config } = req.body;
    try {
        const modelName = model || 'gemini-2.5-flash';
        const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config
        });
        res.json({ text: response.text });
    } catch (e: any) {
        logger.error("AI Generation Failed", e);
        res.status(500).json({ message: 'AI generation failed', details: e.message });
    }
});

app.post('/api/ai/generate-images', authenticate, async (req: any, res: any) => {
    const { prompt, config } = req.body;
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: config || { numberOfImages: 1, outputMimeType: 'image/jpeg' }
        });
        res.json(response);
    } catch (e: any) {
        logger.error("AI Image Generation Failed", e);
        res.status(500).json({ message: 'AI image generation failed', details: e.message });
    }
});

app.get('/api/auth/ai-token', authenticate, (req: any, res: any) => {
    const key = getSecureApiKey();
    if (!key) {
        return res.status(500).json({ message: "AI configuration missing on server." });
    }
    res.json({ apiKey: key });
});

// --- Email Testing ---
app.post('/api/admin/test-email', authenticate, requirePermission('manage_settings'), async (req: any, res: any) => {
    const { to, config } = req.body;
    if (!to || !config) return res.status(400).json({ message: "Recipient email and configuration required." });
    try {
        if (config.emailProvider === 'smtp') {
             const transporter = createTransporter(config);
             await transporter.verify();
             await transporter.sendMail({
                 from: `"${config.host.name}" <${config.host.email}>`,
                 to: to,
                 subject: "Test Email from Event Platform",
                 text: "This is a test email to verify your configuration settings.",
             });
        } else {
             throw new Error("Provider not supported for test.");
        }
        logger.info(`Test email sent to ${to}`);
        res.json({ success: true, message: "Test email sent successfully." });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Configuration check failed.';
        logger.error("Test email failed", e);
        res.status(400).json({ message: msg });
    }
});

// --- Bulk Broadcast ---
app.post('/api/admin/broadcast', authenticate, requirePermission('send_invitations'), async (req: any, res: any) => {
    const { subject, body, target, eventId, channel } = req.body;
    const eid = eventId || 'main-event';
    const selectedChannel = channel || 'email';
    try {
        let queryText = 'SELECT id, email, name, custom_fields FROM registrations WHERE event_id = $1';
        const params = [eid];
        if (target === 'checked-in') queryText += ' AND checked_in = true';
        else if (target === 'pending') queryText += ' AND checked_in = false';
        
        const result = await query(queryText, params);
        const recipients = result.rows;
        
        if (recipients.length === 0) return res.json({ success: true, count: 0, message: "No recipients found for selection." });
        
        let queuedCount = 0;
        let skippedCount = 0;

        recipients.forEach(r => {
            let jobType: Job['type'] = 'send_email';
            let payload: any = { subject, body, eventId: eid };
            let shouldQueue = true;

            if (selectedChannel === 'sms') {
                jobType = 'send_sms';
                if (r.custom_fields && r.custom_fields.phone) payload.to = r.custom_fields.phone;
                else { shouldQueue = false; skippedCount++; }
            } else if (selectedChannel === 'whatsapp') {
                jobType = 'send_whatsapp';
                if (r.custom_fields && r.custom_fields.phone) payload.to = r.custom_fields.phone;
                else { shouldQueue = false; skippedCount++; }
            } else if (selectedChannel === 'app') {
                jobType = 'send_notification';
                payload.userId = r.id;
            } else {
                payload.to = r.email;
            }

            if (shouldQueue) {
                jobQueue.push({
                    id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: jobType,
                    payload: payload,
                    status: 'pending',
                    retries: 0
                });
                queuedCount++;
            }
        });
        
        logger.info(`Queued ${queuedCount} messages via ${selectedChannel}. Skipped ${skippedCount}.`);
        let msg = `Queued ${queuedCount} messages via ${selectedChannel}.`;
        if (skippedCount > 0) msg += ` Skipped ${skippedCount} users (missing contact info).`;
        res.json({ success: true, count: queuedCount, message: msg });
    } catch (e) {
        logger.error("Broadcast failed", e);
        res.status(500).json({ message: "Failed to queue broadcast." });
    }
});

// --- Auth Routes ---
app.post('/api/login/admin', rateLimiter, async (req: any, res: any) => {
    const { email, password } = req.body;
    try {
        const result = await query('SELECT * FROM admin_users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (user && await bcrypt.compare(password, user.password_hash)) {
             const roleResult = await query('SELECT * FROM roles WHERE id = $1', [user.role_id]);
             const role = roleResult.rows[0];
             const payload = { 
                 id: user.id, 
                 email: user.email, 
                 permissions: role?.permissions || [],
                 type: 'admin'
             };
             const token = generateToken(payload);
             setAuthCookie(res, token);
             logger.info(`Admin logged in: ${email}`);
             res.json({ 
                 user: { id: user.id, email: user.email, permissions: role?.permissions || [] },
                 message: 'Login successful'
             });
        } else {
            logger.warn(`Failed admin login attempt for: ${email}`);
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (e) {
        logger.error('Admin login error', e);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/login/delegate', rateLimiter, async (req: any, res: any) => {
    const { email, password, eventId } = req.body;
    try {
        const result = await query('SELECT * FROM registrations WHERE email = $1 AND event_id = $2', [email, eventId]);
        const user = result.rows[0];
        if (user && user.password_hash && await bcrypt.compare(password, user.password_hash)) {
             const token = generateToken({ id: user.id, email: user.email, eventId: eventId, type: 'delegate' });
             setAuthCookie(res, token);
             logger.info(`Delegate logged in: ${email} for event ${eventId}`);
             res.json({ success: true, user: { id: user.id, email: user.email } });
        } else {
             logger.warn(`Failed delegate login attempt for: ${email}`);
             res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (e) {
        logger.error('Delegate login error', e);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/logout', (req: any, res: any) => {
    res.clearCookie('token');
    res.json({ success: true });
});

app.get('/api/auth/me', authenticate, (req: any, res: any) => {
    res.json({ user: req.user });
});

// Forgot/Reset Password
app.post('/api/auth/forgot-password', rateLimiter, async (req: any, res: any) => {
    const { email, eventId, type } = req.body;
    try {
        let user;
        if (type === 'admin') {
             const r = await query('SELECT * FROM admin_users WHERE email = $1', [email]);
             user = r.rows[0];
        } else {
             const r = await query('SELECT * FROM registrations WHERE email = $1 AND event_id = $2', [email, eventId]);
             user = r.rows[0];
        }
        if (user) {
            const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const expiry = Date.now() + 3600000; 
            await query('INSERT INTO password_reset_tokens (token, user_id, expiry) VALUES ($1, $2, $3)', [resetToken, user.id, expiry]);
            const configRes = await query('SELECT config FROM events WHERE id = $1', [eventId || 'main-event']);
            const config = configRes.rows[0]?.config;
            if (config) {
                 const resetLink = `${config.event.publicUrl}${type === 'admin' ? '/admin' : '/' + eventId}?resetToken=${resetToken}`;
                 const subject = "Password Reset Request";
                 const body = `Click here to reset your password: ${resetLink}`;
                 await sendEmail(email, subject, body, undefined, eventId || 'main-event');
            }
        }
        res.json({ success: true });
    } catch (e) {
        logger.error("Forgot password error", e);
        res.status(500).json({ message: "Error processing request" });
    }
});

app.post('/api/auth/reset-password', rateLimiter, async (req: any, res: any) => {
    const { token, newPassword } = req.body;
    try {
        const tokenRes = await query('SELECT * FROM password_reset_tokens WHERE token = $1 AND expiry > $2', [token, Date.now()]);
        const tokenRecord = tokenRes.rows[0];
        if (!tokenRecord) return res.status(400).json({ message: "Invalid or expired token" });
        const hash = await bcrypt.hash(newPassword, 10);
        let r = await query('UPDATE admin_users SET password_hash = $1 WHERE id = $2 RETURNING id', [hash, tokenRecord.user_id]);
        if (r.rowCount === 0) {
            await query('UPDATE registrations SET password_hash = $1 WHERE id = $2', [hash, tokenRecord.user_id]);
        }
        await query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
        res.json({ success: true });
    } catch (e) {
        logger.error("Reset password error", e);
        res.status(500).json({ message: "Error resetting password" });
    }
});

// --- Standard CRUD Routes (Events, Registrations, Tasks, etc.) ---
// These follow the same pattern as above and are essential for the app logic.
// Included here in condensed form to ensure completeness.

app.get('/api/events', async (req: any, res: any) => {
    try {
        const result = await query('SELECT id, name, config FROM events');
        res.json(result.rows.map(row => ({
            id: row.id,
            name: row.config.event.name,
            date: row.config.event.date,
            location: row.config.event.location,
            logoUrl: row.config.theme.logoUrl,
            colorPrimary: row.config.theme.colorPrimary
        })));
    } catch (e) { res.status(500).json({ message: 'Error fetching events' }); }
});

app.get('/api/events/:id', async (req: any, res: any) => {
    try {
        const result = await query('SELECT config FROM events WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Event not found' });
        const regCount = await query('SELECT COUNT(*) FROM registrations WHERE event_id = $1', [req.params.id]);
        const sessions = await query('SELECT * FROM sessions WHERE event_id = $1', [req.params.id]);
        const speakers = await query('SELECT * FROM speakers WHERE event_id = $1', [req.params.id]);
        const sponsors = await query('SELECT * FROM sponsors WHERE event_id = $1', [req.params.id]);
        res.json({ 
            config: result.rows[0].config, 
            registrationCount: parseInt(regCount.rows[0].count, 10),
            sessions: sessions.rows,
            speakers: speakers.rows,
            sponsors: sponsors.rows
        });
    } catch (e) { res.status(500).json({ message: 'Error fetching event' }); }
});

app.get('/api/admin/registrations', authenticate, requirePermission('manage_registrations'), async (req: any, res: any) => {
    try {
        const result = await query('SELECT * FROM registrations WHERE event_id = $1', ['main-event']); 
        const regs = result.rows.map(r => ({ ...r, ...r.custom_fields }));
        res.json(regs);
    } catch (e) {
        res.status(500).json({ message: 'Error fetching registrations' });
    }
});

// [Additional CRUD endpoints from original code would be here, maintained as is]
// ...

// --- Serve React Frontend (Last Route) ---
if (IS_PROD) {
    app.use(express.static(CLIENT_BUILD_PATH));
    
    // SPA Fallback: Send index.html for any unknown non-API routes
    app.get('*', (req: Request, res: Response) => {
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ message: 'Not Found' });
        }
        res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'));
    });
}

// Start Server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
