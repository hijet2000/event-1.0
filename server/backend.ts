
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
declare var Buffer: any; // Fix for missing Buffer type
declare var process: any; // Fix for process type issues

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
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
// Cast process to any to avoid 'Property cwd does not exist on type Process' error
const UPLOADS_DIR = path.join((process as any).cwd(), 'uploads');
const CLIENT_BUILD_PATH = path.join((process as any).cwd(), 'dist'); // Assuming Vite build output is 'dist'
const writeFileAsync = promisify(fs.writeFile);

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    logger.info(`Created uploads directory at ${UPLOADS_DIR}`);
}

// --- Security Middleware ---

// 1. Rate Limiter (In-Memory for prototype, use Redis for distributed)
const rateLimit = new Map<string, { count: number, startTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // 100 requests per window

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

// Serve React Frontend (Production)
if (IS_PROD) {
    app.use(express.static(CLIENT_BUILD_PATH));
    logger.info(`Serving static files from ${CLIENT_BUILD_PATH}`);
}

// Log all requests
app.use((req, res, next) => {
    // Don't log static asset requests to keep logs clean
    if (!req.url.startsWith('/assets') && !req.url.startsWith('/uploads')) {
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
    // Checks if a file path is provided in env var GEMINI_API_KEY_FILE
    if (process.env.GEMINI_API_KEY_FILE) {
        try {
            if (fs.existsSync(process.env.GEMINI_API_KEY_FILE)) {
                return fs.readFileSync(process.env.GEMINI_API_KEY_FILE, 'utf8').trim();
            }
        } catch (error) {
            logger.warn(`Failed to read secret file at ${process.env.GEMINI_API_KEY_FILE}`);
        }
    }

    // Priority 2: Standard Environment Variable (Development / Standard PaaS)
    if (process.env.API_KEY) {
        return process.env.API_KEY;
    }

    // Priority 3: Integration point for AWS/GCP Secret Manager SDKs would go here
    
    logger.error("CRITICAL: Gemini API Key not found in environment variables or secret files.");
    return ""; 
};

// AI Client Initialization
const apiKey = getSecureApiKey();
if (!apiKey && IS_PROD) {
    logger.error("Server starting without API Key. AI features will fail.");
}
// Initialize with found key or a dummy if missing to allow server startup (requests will fail gracefully)
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
            secure: config.smtp.encryption === 'ssl', // true for 465, false for other ports
            auth: {
                user: config.smtp.username,
                pass: config.smtp.password,
            },
        });
    }
    // Placeholder for Google Service Account Logic
    // For now, fallback to a mock or throw if not SMTP
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
                 from: `"${config.host.name}" <${config.host.email}>`, // sender address
                 to: to, // list of receivers
                 subject: subject, // Subject line
                 text: body, // plain text body
                 html: html || body.replace(/\n/g, '<br>'), // html body
             });
             logger.info(`Email sent to ${to}`);
             
             // Log to DB
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
            // In a real implementation, call Twilio API here using config
            await new Promise(r => setTimeout(r, 200));
        } else if (pendingJob.type === 'send_whatsapp') {
             const { to, body } = pendingJob.payload;
             logger.info(`[WhatsApp Simulation] Sending to ${to}: ${body}`);
             // In a real implementation, call WhatsApp Business API
             await new Promise(r => setTimeout(r, 200));
        } else if (pendingJob.type === 'send_notification') {
             const { userId, body } = pendingJob.payload;
             logger.info(`[In-App Notification Simulation] Sending to user ${userId}: ${body}`);
             await new Promise(r => setTimeout(r, 100));
             // Ideally insert into a 'notifications' table here
        }

        pendingJob.status = 'completed';
        // Cleanup completed job after a while or move to history
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
        
        // 2. Clean up orphaned files (simplified logic: if not in media table, delete from disk)
        // In a real app, we'd also check if media is referenced in events/users tables.
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
    const token = req.cookies.token; // Read from cookie, not header
    
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
        
        // Super Admins (or specific role checks) can bypass, but relying on permissions list is best
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
        httpOnly: true, // JavaScript cannot access this
        secure: IS_PROD, // HTTPS only in production
        sameSite: 'strict', // STRICT for max security
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
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
} as any);

// --- AI Proxy Endpoints (Secure) ---
app.post('/api/ai/generate', authenticate, async (req: any, res: any) => {
    const { model, contents, config } = req.body;
    try {
        // Determine model based on use case if not provided
        const modelName = model || 'gemini-2.5-flash';
        
        const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config
        });
        
        // If the model returns a raw string, wrapping it might be needed by client expectations
        // But generateContentResponse usually has .text property access
        res.json({ text: response.text });
    } catch (e: any) {
        logger.error("AI Generation Failed", e);
        res.status(500).json({ message: 'AI generation failed', details: e.message });
    }
} as any);

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
} as any);

// Endpoint to securely provide API Key to authenticated clients for Live API usage
app.get('/api/auth/ai-token', authenticate, (req: any, res: any) => {
    // In a real production environment, this should issue a short-lived token
    // or STS token. For this prototype, we send the key but only to authenticated users.
    const key = getSecureApiKey();
    if (!key) {
        return res.status(500).json({ message: "AI configuration missing on server." });
    }
    res.json({ apiKey: key });
} as any);

// --- Email Testing Endpoint ---
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
} as any);

// --- Bulk Broadcast (Admin) ---
app.post('/api/admin/broadcast', authenticate, requirePermission('send_invitations'), async (req: any, res: any) => {
    const { subject, body, target, eventId, channel } = req.body;
    const eid = eventId || 'main-event';
    const selectedChannel = channel || 'email';
    
    try {
        let queryText = 'SELECT id, email, name, custom_fields FROM registrations WHERE event_id = $1';
        const params = [eid];
        
        if (target === 'checked-in') {
            queryText += ' AND checked_in = true';
        } else if (target === 'pending') {
            queryText += ' AND checked_in = false';
        }
        
        const result = await query(queryText, params);
        const recipients = result.rows;
        
        if (recipients.length === 0) {
            return res.json({ success: true, count: 0, message: "No recipients found for selection." });
        }
        
        let queuedCount = 0;
        let skippedCount = 0;

        // Add to Queue based on channel
        recipients.forEach(r => {
            let jobType: Job['type'] = 'send_email';
            let payload: any = { subject, body, eventId: eid };
            let shouldQueue = true;

            if (selectedChannel === 'sms') {
                jobType = 'send_sms';
                // Check for phone number in custom fields
                if (r.custom_fields && r.custom_fields.phone) {
                    payload.to = r.custom_fields.phone;
                } else {
                    // Skip if no phone number
                    shouldQueue = false;
                    skippedCount++;
                }
            } else if (selectedChannel === 'whatsapp') {
                jobType = 'send_whatsapp';
                if (r.custom_fields && r.custom_fields.phone) {
                    payload.to = r.custom_fields.phone;
                } else {
                    shouldQueue = false;
                    skippedCount++;
                }
            } else if (selectedChannel === 'app') {
                jobType = 'send_notification';
                payload.userId = r.id;
            } else {
                // Default email
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
        if (skippedCount > 0) {
            msg += ` Skipped ${skippedCount} users (missing contact info).`;
        }
        
        res.json({ success: true, count: queuedCount, message: msg });
        
    } catch (e) {
        logger.error("Broadcast failed", e);
        res.status(500).json({ message: "Failed to queue broadcast." });
    }
} as any);

// --- Authentication ---

// Admin Login
app.post('/api/login/admin', rateLimiter as any, async (req: any, res: any) => {
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

             // Return user info but NOT the token
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
} as any);

// Delegate Login
app.post('/api/login/delegate', rateLimiter as any, async (req: any, res: any) => {
    const { email, password, eventId } = req.body;
    try {
        const result = await query('SELECT * FROM registrations WHERE email = $1 AND event_id = $2', [email, eventId]);
        const user = result.rows[0];

        if (user && user.password_hash && await bcrypt.compare(password, user.password_hash)) {
             const token = generateToken({ 
                 id: user.id, 
                 email: user.email, 
                 eventId: eventId,
                 type: 'delegate'
             });
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
} as any);

app.post('/api/logout', (req: any, res: any) => {
    res.clearCookie('token');
    res.json({ success: true });
} as any);

// Check Session
app.get('/api/auth/me', authenticate, (req: any, res: any) => {
    res.json({ user: req.user });
} as any);

// Forgot Password
app.post('/api/auth/forgot-password', rateLimiter as any, async (req: any, res: any) => {
    const { email, eventId, type } = req.body;
    try {
        let user;
        let table;
        if (type === 'admin') {
             const r = await query('SELECT * FROM admin_users WHERE email = $1', [email]);
             user = r.rows[0];
             table = 'admin_users';
        } else {
             const r = await query('SELECT * FROM registrations WHERE email = $1 AND event_id = $2', [email, eventId]);
             user = r.rows[0];
             table = 'registrations';
        }

        if (user) {
            const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const expiry = Date.now() + 3600000; // 1 hour
            
            // Store token (assuming a tokens table exists or handled in a simpler way, here we insert into password_reset_tokens)
            await query('INSERT INTO password_reset_tokens (token, user_id, expiry) VALUES ($1, $2, $3)', [resetToken, user.id, expiry]);
            
            // Generate Email Content via AI
            // We need event config for context
            const configRes = await query('SELECT config FROM events WHERE id = $1', [eventId || 'main-event']);
            const config = configRes.rows[0]?.config;
            
            if (config) {
                 const resetLink = `${config.event.publicUrl}${type === 'admin' ? '/admin' : '/' + eventId}?resetToken=${resetToken}`;
                 // Simple template fallback if AI fails or for speed
                 const subject = "Password Reset Request";
                 const body = `Click here to reset your password: ${resetLink}`;
                 
                 await sendEmail(email, subject, body, undefined, eventId || 'main-event');
            }
        }
        // Always return success to prevent enumeration
        res.json({ success: true });
    } catch (e) {
        logger.error("Forgot password error", e);
        res.status(500).json({ message: "Error processing request" });
    }
} as any);

// Reset Password
app.post('/api/auth/reset-password', rateLimiter as any, async (req: any, res: any) => {
    const { token, newPassword } = req.body;
    try {
        const tokenRes = await query('SELECT * FROM password_reset_tokens WHERE token = $1 AND expiry > $2', [token, Date.now()]);
        const tokenRecord = tokenRes.rows[0];
        
        if (!tokenRecord) return res.status(400).json({ message: "Invalid or expired token" });
        
        const hash = await bcrypt.hash(newPassword, 10);
        
        // Try update admin
        let r = await query('UPDATE admin_users SET password_hash = $1 WHERE id = $2 RETURNING id', [hash, tokenRecord.user_id]);
        if (r.rowCount === 0) {
            // Try update delegate
            await query('UPDATE registrations SET password_hash = $1 WHERE id = $2', [hash, tokenRecord.user_id]);
        }
        
        await query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
        res.json({ success: true });
    } catch (e) {
        logger.error("Reset password error", e);
        res.status(500).json({ message: "Error resetting password" });
    }
} as any);


// --- Events ---

// List Public Events
app.get('/api/events', async (req: any, res: any) => {
    try {
        const result = await query('SELECT id, name, config FROM events');
        const publicEvents = result.rows.map(row => ({
            id: row.id,
            name: row.config.event.name,
            date: row.config.event.date,
            location: row.config.event.location,
            logoUrl: row.config.theme.logoUrl,
            colorPrimary: row.config.theme.colorPrimary
        }));
        res.json(publicEvents);
    } catch (e) {
        res.status(500).json({ message: 'Error fetching events' });
    }
} as any);

// Get Event Config
app.get('/api/events/:id', async (req: any, res: any) => {
    try {
        const result = await query('SELECT config FROM events WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Event not found' });
        
        const regCountResult = await query('SELECT COUNT(*) FROM registrations WHERE event_id = $1', [req.params.id]);
        
        // Fetch public related data for full context
        const sessions = await query('SELECT * FROM sessions WHERE event_id = $1', [req.params.id]);
        const speakers = await query('SELECT * FROM speakers WHERE event_id = $1', [req.params.id]);
        const sponsors = await query('SELECT * FROM sponsors WHERE event_id = $1', [req.params.id]);

        res.json({ 
            config: result.rows[0].config, 
            registrationCount: parseInt(regCountResult.rows[0].count, 10),
            sessions: sessions.rows,
            speakers: speakers.rows,
            sponsors: sponsors.rows
        });
    } catch (e) {
        res.status(500).json({ message: 'Error fetching event' });
    }
} as any);

// Save Event Config - Protected
app.put('/api/events/:id/config', authenticate, requirePermission('manage_settings'), async (req: any, res: any) => {
    try {
        const { config } = req.body;
        await query('UPDATE events SET config = $1 WHERE id = $2', [config, req.params.id]);
        res.json(config);
    } catch (e) {
        res.status(500).json({ message: 'Error saving config' });
    }
} as any);

// Create Event - Protected
app.post('/api/events', authenticate, requirePermission('manage_settings'), async (req: any, res: any) => {
    const { name, eventType, config } = req.body;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + `-${Date.now()}`;
    
    const newConfig = { ...config };
    newConfig.event.name = name;
    newConfig.event.eventType = eventType;
    
    try {
        await query('INSERT INTO events (id, name, config, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, name, newConfig, Date.now()]);
        res.json({ id, name, config: newConfig });
    } catch (e) {
        res.status(500).json({ message: 'Error creating event' });
    }
} as any);

// --- Admin Dashboard ---

app.get('/api/admin/dashboard-stats', authenticate, requirePermission('view_dashboard'), async (req: any, res: any) => {
    try {
        const eventId = req.query.eventId || 'main-event';
        const regCount = await query('SELECT COUNT(*) FROM registrations WHERE event_id = $1', [eventId]);
        const recentRegs = await query('SELECT * FROM registrations WHERE event_id = $1 ORDER BY created_at DESC LIMIT 5', [eventId]);
        const formattedRegs = recentRegs.rows.map(r => ({ ...r, ...r.custom_fields }));
        const txStats = await query('SELECT SUM(amount) as circulation FROM transactions WHERE type IN (\'initial\', \'purchase\', \'reward\')');
        
        // Trend Data (Last 7 days)
        const trendQuery = `
            SELECT to_char(to_timestamp(created_at / 1000), 'YYYY-MM-DD') as day, COUNT(*) as count
            FROM registrations 
            WHERE event_id = $1 
            GROUP BY day 
            ORDER BY day DESC 
            LIMIT 7
        `;
        const trendResult = await query(trendQuery, [eventId]);
        
        // Task Stats
        const taskQuery = `SELECT status, COUNT(*) as count FROM tasks WHERE event_id = $1 GROUP BY status`;
        const taskResult = await query(taskQuery, [eventId]);
        
        const taskStats = { total: 0, completed: 0, pending: 0 };
        taskResult.rows.forEach(row => {
            const count = parseInt(row.count);
            taskStats.total += count;
            if (row.status === 'completed') taskStats.completed += count;
            else taskStats.pending += count;
        });

        res.json({
            totalRegistrations: parseInt(regCount.rows[0].count),
            maxAttendees: 500, 
            eventDate: "October 26-28, 2025", 
            eventCoinName: "EventCoin", 
            eventCoinCirculation: parseFloat(txStats.rows[0].circulation || '0'),
            recentRegistrations: formattedRegs,
            registrationTrend: trendResult.rows.map(r => ({ date: r.day, count: parseInt(r.count) })),
            taskStats
        });
    } catch (e) {
        res.status(500).json({ message: 'Error fetching stats' });
    }
} as any);

// --- Registrations ---

app.get('/api/admin/registrations', authenticate, requirePermission('manage_registrations'), async (req: any, res: any) => {
    try {
        const eventId = req.query.eventId || 'main-event';
        const result = await query('SELECT * FROM registrations WHERE event_id = $1', [eventId]); 
        const regs = result.rows.map(r => ({ ...r, ...r.custom_fields }));
        res.json(regs);
    } catch (e) {
        res.status(500).json({ message: 'Error fetching registrations' });
    }
} as any);

app.post('/api/registrations', rateLimiter as any, async (req: any, res: any) => {
    const { eventId, data, inviteToken } = req.body;
    const { name, email, password, ...customFields } = data;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const check = await client.query('SELECT id FROM registrations WHERE event_id = $1 AND email = $2', [eventId, email]);
        if (check.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Email already registered.' });
        }

        const id = `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const passwordHash = password ? await bcrypt.hash(password, 10) : null;

        await client.query(
            `INSERT INTO registrations (id, event_id, name, email, password_hash, custom_fields, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, eventId, name, email, passwordHash, customFields, Date.now()]
        );

        if (inviteToken) await client.query('DELETE FROM invite_tokens WHERE token = $1', [inviteToken]);
        
        // Initial Balance
        await client.query('INSERT INTO transactions (id, from_id, from_name, from_email, to_id, to_name, to_email, amount, message, type, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
            [`tx_init_${id}`, 'system', 'System', 'system', id, name, email, 100, 'Welcome Bonus', 'initial', Date.now()]
        );

        await client.query('COMMIT');
        logger.info(`New registration: ${email} for event ${eventId}`);
        
        // Send Confirmation Email (Async, don't block response)
        (async () => {
            try {
                const configRes = await query('SELECT config FROM events WHERE id = $1', [eventId]);
                const config = configRes.rows[0]?.config;
                if (config) {
                     // Generate AI content
                     // const prompt = `Generate a confirmation email for event ${config.event.name}. User: ${name}.`;
                     // For now using a simple template if AI call is too complex to inline here without context
                     const subject = `Registration Confirmed: ${config.event.name}`;
                     const body = `Hi ${name},\n\nThanks for registering! Your ID is ${id}.`;
                     await sendEmail(email, subject, body, undefined, eventId);
                }
            } catch (emailErr) {
                logger.error("Failed to send confirmation email", emailErr);
            }
        })();

        res.json({ success: true, message: 'Registration successful' });
    } catch (e) {
        await client.query('ROLLBACK');
        logger.error('Database error during registration', e);
        res.status(500).json({ success: false, message: 'Database error during registration' });
    } finally {
        client.release();
    }
} as any);

// Invitation (Admin)
app.post('/api/admin/invite', authenticate, requirePermission('send_invitations'), async (req: any, res: any) => {
    const { email, eventId } = req.body;
    try {
        const token = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await query('INSERT INTO invite_tokens (token, event_id, email) VALUES ($1, $2, $3)', [token, eventId, email]);
        
        const configRes = await query('SELECT config FROM events WHERE id = $1', [eventId]);
        const config = configRes.rows[0]?.config;
        
        if (config) {
             const inviteLink = `${config.event.publicUrl}/${eventId}?inviteToken=${token}`;
             const subject = `You're invited to ${config.event.name}`;
             const body = `Hi,\n\nYou have been invited to register for ${config.event.name}.\n\nClick here to register: ${inviteLink}`;
             await sendEmail(email, subject, body, undefined, eventId);
        }
        res.json({ success: true });
    } catch (e) {
        logger.error("Invitation failed", e);
        res.status(500).json({ message: "Failed to send invitation" });
    }
} as any);


// Update Registration (Admin)
app.put('/api/admin/registrations/:id', authenticate, requirePermission('manage_registrations'), async (req: any, res: any) => {
    const { name, email, customFields, checkedIn } = req.body;
    const id = req.params.id;
    
    try {
        if (name) await query('UPDATE registrations SET name = $1 WHERE id = $2', [name, id]);
        if (email) await query('UPDATE registrations SET email = $1 WHERE id = $2', [email, id]);
        if (customFields) await query('UPDATE registrations SET custom_fields = $1 WHERE id = $2', [customFields, id]);
        if (typeof checkedIn === 'boolean') await query('UPDATE registrations SET checked_in = $1 WHERE id = $2', [checkedIn, id]);

        res.json({ success: true, message: 'Registration updated' });
    } catch (e) {
        logger.error('Error updating registration', e);
        res.status(500).json({ message: 'Update failed' });
    }
} as any);

// Delete Registration (Admin)
app.delete('/api/admin/registrations/:id', authenticate, requirePermission('manage_registrations'), async (req: any, res: any) => {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM transactions WHERE from_id = $1 OR to_id = $1', [req.params.id]);
            await client.query('DELETE FROM meal_consumption_logs WHERE delegate_id = $1', [req.params.id]);
            await client.query('DELETE FROM accommodation_bookings WHERE delegate_id = $1', [req.params.id]);
            await client.query('DELETE FROM registrations WHERE id = $1', [req.params.id]);
            await client.query('COMMIT');
            res.json({ success: true });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (e) {
        logger.error('Error deleting registration', e);
        res.status(500).json({ message: 'Delete failed' });
    }
} as any);

// --- Admin Wallet Management ---
app.post('/api/admin/wallet/transaction', authenticate, requirePermission('manage_settings'), async (req: any, res: any) => {
    const { recipientEmail, amount, message } = req.body;
    const numericAmount = parseFloat(amount);
    
    if (isNaN(numericAmount) || numericAmount === 0) return res.status(400).json({ message: "Invalid amount" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userRes = await client.query('SELECT id, name FROM registrations WHERE email = $1', [recipientEmail]);
        const user = userRes.rows[0];
        
        if (!user) {
             await client.query('ROLLBACK');
             return res.status(404).json({ message: "User not found" });
        }

        if (numericAmount > 0) {
             // Issuance
             await client.query('INSERT INTO transactions (id, from_id, from_name, from_email, to_id, to_name, to_email, amount, message, type, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                 [`tx_adm_${Date.now()}`, 'system', 'System (Admin)', 'system', user.id, user.name, recipientEmail, numericAmount, message, 'admin_adjustment', Date.now()]
             );
        } else {
             // Deduction
             const txs = await client.query('SELECT * FROM transactions WHERE from_id = $1 OR to_id = $1', [user.id]);
             let balance = 0;
             for (const tx of txs.rows) {
                if (tx.to_id === user.id) balance += parseFloat(tx.amount);
                if (tx.from_id === user.id) balance -= parseFloat(tx.amount);
             }
             
             if (balance < Math.abs(numericAmount)) {
                 await client.query('ROLLBACK');
                 return res.status(400).json({ message: "Insufficient user funds for deduction." });
             }

             await client.query('INSERT INTO transactions (id, from_id, from_name, from_email, to_id, to_name, to_email, amount, message, type, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                 [`tx_adm_${Date.now()}`, user.id, user.name, recipientEmail, 'system', 'System (Admin)', 'system', Math.abs(numericAmount), message, 'admin_adjustment', Date.now()]
             );
        }

        await client.query('COMMIT');
        logger.info(`Admin wallet adjustment: ${numericAmount} for ${recipientEmail}`);
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        logger.error('Error processing admin transaction', e);
        res.status(500).json({ message: 'Error processing transaction' });
    } finally {
        client.release();
    }
} as any);

// --- Secure Payment Processing (Stripe Simulation) ---
app.post('/api/payments/purchase', authenticate, async (req: any, res: any) => {
    const { amount, cost, paymentMethodId } = req.body;
    
    if (!amount || !cost || amount <= 0) {
        return res.status(400).json({ message: "Invalid purchase amount." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const userRes = await client.query('SELECT * FROM registrations WHERE id = $1', [req.user.id]);
        const user = userRes.rows[0];

        if (!user) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "User not found." });
        }

        // --- Stripe Simulation Start ---
        // Mock success
        const paymentId = `pi_sim_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        logger.info(`Simulated payment success: ${cost} USD for ${amount} Coins. ID: ${paymentId}`);
        // --- Stripe Simulation End ---

        await client.query('INSERT INTO transactions (id, from_id, from_name, from_email, to_id, to_name, to_email, amount, message, type, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
             [`tx_purchase_${Date.now()}`, 'payment_gateway', 'Credit Card Top-up', 'stripe-sim@example.com', user.id, user.name, user.email, amount, `Purchase of ${amount} Coins (Ref: ${paymentId})`, 'purchase', Date.now()]
        );

        await client.query('COMMIT');
        res.json({ success: true, transactionId: `tx_purchase_${Date.now()}` });

    } catch (e: any) {
        await client.query('ROLLBACK');
        logger.error("Payment processing failed", e);
        res.status(500).json({ message: "Payment processing failed." });
    } finally {
        client.release();
    }
} as any);

// --- Users & Roles ---

app.get('/api/admin/users', authenticate, requirePermission('manage_users'), async (req: any, res: any) => {
    try {
        const result = await query('SELECT * FROM admin_users');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);

app.post('/api/admin/users', authenticate, requirePermission('manage_users'), async (req: any, res: any) => {
    const { id, email, password, roleId } = req.body;
    try {
        if (id) {
            await query('UPDATE admin_users SET email = $1, role_id = $2 WHERE id = $3', [email, roleId, id]);
        } else {
            const hash = await bcrypt.hash(password, 10);
            const newId = `user_${Date.now()}`;
            await query('INSERT INTO admin_users (id, email, password_hash, role_id, created_at) VALUES ($1, $2, $3, $4, $5)', [newId, email, hash, roleId, Date.now()]);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ message: 'Error saving user' }); }
} as any);

app.delete('/api/admin/users/:id', authenticate, requirePermission('manage_users'), async (req: any, res: any) => {
    await query('DELETE FROM admin_users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
} as any);

app.get('/api/admin/roles', authenticate, requirePermission('manage_users'), async (req: any, res: any) => {
    try {
        const result = await query('SELECT * FROM roles');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);

// --- Tasks ---
app.get('/api/tasks', authenticate, requirePermission('manage_tasks'), async (req: any, res: any) => {
    try {
        const eventId = req.query.eventId || 'main-event';
        const result = await query('SELECT * FROM tasks WHERE event_id = $1', [eventId]);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.post('/api/tasks', authenticate, requirePermission('manage_tasks'), async (req: any, res: any) => {
    const task = req.body;
    try {
        if (task.id) {
            await query('UPDATE tasks SET title=$1, description=$2, status=$3, priority=$4, assignee_email=$5, due_date=$6 WHERE id=$7', [task.title, task.description, task.status, task.priority, task.assigneeEmail, task.dueDate, task.id]);
        } else {
            await query('INSERT INTO tasks (id, event_id, title, description, status, priority, assignee_email, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [`task_${Date.now()}`, task.eventId || 'main-event', task.title, task.description, task.status, task.priority, task.assigneeEmail, task.dueDate]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.delete('/api/tasks/:id', authenticate, requirePermission('manage_tasks'), async (req: any, res: any) => {
    await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ success: true });
} as any);

// --- Agenda (Sessions) ---
app.get('/api/sessions', async (req: any, res: any) => {
    try {
        const eventId = req.query.eventId || 'main-event';
        const result = await query('SELECT * FROM sessions WHERE event_id = $1 ORDER BY start_time ASC', [eventId]);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);

// Calendar Export (ICS)
app.get('/api/sessions/:id/ics', async (req: any, res: any) => {
    try {
        const sessionId = req.params.id;
        const result = await query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
        const session = result.rows[0];
        
        if (!session) return res.status(404).send("Session not found");

        const formatDate = (dateStr: string) => {
             return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//EventPlatform//NONSGML v1.0//EN',
            'BEGIN:VEVENT',
            `UID:${session.id}`,
            `DTSTAMP:${formatDate(new Date().toISOString())}`,
            `DTSTART:${formatDate(session.start_time)}`,
            `DTEND:${formatDate(session.end_time)}`,
            `SUMMARY:${session.title}`,
            `DESCRIPTION:${session.description}`,
            `LOCATION:${session.location}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', `attachment; filename="${session.title.replace(/[^a-z0-9]/gi, '_')}.ics"`);
        res.send(icsContent);

    } catch (e) {
        logger.error("ICS Export Failed", e);
        res.status(500).send("Error generating calendar file");
    }
} as any);

app.post('/api/sessions', authenticate, requirePermission('manage_agenda'), async (req: any, res: any) => {
    const s = req.body;
    const eventId = s.eventId || 'main-event';
    try {
        if (s.id) {
            await query('UPDATE sessions SET title=$1, description=$2, start_time=$3, end_time=$4, location=$5, speaker_ids=$6, track=$7, capacity=$8 WHERE id=$9', [s.title, s.description, s.startTime, s.endTime, s.location, JSON.stringify(s.speakerIds), s.track, s.capacity, s.id]);
        } else {
            await query('INSERT INTO sessions (id, event_id, title, description, start_time, end_time, location, speaker_ids, track, capacity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [`sess_${Date.now()}`, eventId, s.title, s.description, s.startTime, s.endTime, s.location, JSON.stringify(s.speakerIds), s.track, s.capacity]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.delete('/api/sessions/:id', authenticate, requirePermission('manage_agenda'), async (req: any, res: any) => {
    await query('DELETE FROM sessions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
} as any);

// --- Speakers ---
app.get('/api/speakers', async (req: any, res: any) => {
    try {
        const eventId = req.query.eventId || 'main-event';
        const result = await query('SELECT * FROM speakers WHERE event_id = $1', [eventId]);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.post('/api/speakers', authenticate, requirePermission('manage_speakers_sponsors'), async (req: any, res: any) => {
    const s = req.body;
    const eventId = s.eventId || 'main-event';
    try {
        if (s.id) {
             await query('UPDATE speakers SET name=$1, title=$2, company=$3, bio=$4, photo_url=$5 WHERE id=$6', [s.name, s.title, s.company, s.bio, s.photoUrl, s.id]);
        } else {
            await query('INSERT INTO speakers (id, event_id, name, title, company, bio, photo_url) VALUES ($1, $2, $3, $4, $5, $6, $7)', [`spk_${Date.now()}`, eventId, s.name, s.title, s.company, s.bio, s.photoUrl]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.delete('/api/speakers/:id', authenticate, requirePermission('manage_speakers_sponsors'), async (req: any, res: any) => {
    await query('DELETE FROM speakers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
} as any);

// --- Sponsors ---
app.get('/api/sponsors', async (req: any, res: any) => {
    try {
        const eventId = req.query.eventId || 'main-event';
        const result = await query('SELECT * FROM sponsors WHERE event_id = $1', [eventId]);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.post('/api/sponsors', authenticate, requirePermission('manage_speakers_sponsors'), async (req: any, res: any) => {
    const s = req.body;
    const eventId = s.eventId || 'main-event';
    try {
        if (s.id) {
             await query('UPDATE sponsors SET name=$1, description=$2, website_url=$3, logo_url=$4, tier=$5 WHERE id=$6', [s.name, s.description, s.websiteUrl, s.logoUrl, s.tier, s.id]);
        } else {
            await query('INSERT INTO sponsors (id, event_id, name, description, website_url, logo_url, tier) VALUES ($1, $2, $3, $4, $5, $6, $7)', [`spn_${Date.now()}`, eventId, s.name, s.description, s.websiteUrl, s.logoUrl, s.tier]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.delete('/api/sponsors/:id', authenticate, requirePermission('manage_speakers_sponsors'), async (req: any, res: any) => {
    await query('DELETE FROM sponsors WHERE id = $1', [req.params.id]);
    res.json({ success: true });
} as any);

// --- Logistics (Hotels, Dining) ---
app.get('/api/hotels', async (req: any, res: any) => {
    try {
        const result = await query('SELECT * FROM hotels'); 
        res.json(result.rows);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.post('/api/hotels', authenticate, requirePermission('manage_accommodation'), async (req: any, res: any) => {
    const h = req.body;
    try {
        if (h.id) {
             await query('UPDATE hotels SET name=$1, description=$2, address=$3, booking_url=$4, room_types=$5 WHERE id=$6', [h.name, h.description, h.address, h.bookingUrl, JSON.stringify(h.roomTypes), h.id]);
        } else {
            await query('INSERT INTO hotels (id, name, description, address, booking_url, room_types) VALUES ($1, $2, $3, $4, $5, $6)', [`hotel_${Date.now()}`, h.name, h.description, h.address, h.bookingUrl, JSON.stringify(h.roomTypes)]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.delete('/api/hotels/:id', authenticate, requirePermission('manage_accommodation'), async (req: any, res: any) => {
    await query('DELETE FROM hotels WHERE id = $1', [req.params.id]);
    res.json({ success: true });
} as any);

app.get('/api/meal-plans', async (req: any, res: any) => {
    try {
        const result = await query('SELECT * FROM meal_plans');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.post('/api/meal-plans', authenticate, requirePermission('manage_dining'), async (req: any, res: any) => {
    const p = req.body;
    try {
        if (p.id) {
            await query('UPDATE meal_plans SET name=$1, description=$2, daily_cost=$3 WHERE id=$4', [p.name, p.description, p.dailyCost, p.id]);
        } else {
            await query('INSERT INTO meal_plans (id, name, description, daily_cost) VALUES ($1, $2, $3, $4)', [`mp_${Date.now()}`, p.name, p.description, p.dailyCost]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.delete('/api/meal-plans/:id', authenticate, requirePermission('manage_dining'), async (req: any, res: any) => {
    await query('DELETE FROM meal_plans WHERE id = $1', [req.params.id]);
    res.json({ success: true });
} as any);

app.get('/api/restaurants', async (req: any, res: any) => {
    try {
        const result = await query('SELECT * FROM restaurants');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.post('/api/restaurants', authenticate, requirePermission('manage_dining'), async (req: any, res: any) => {
    const r = req.body;
    try {
        if (r.id) {
             await query('UPDATE restaurants SET name=$1, cuisine=$2, operating_hours=$3, menu=$4 WHERE id=$5', [r.name, r.cuisine, r.operatingHours, r.menu, r.id]);
        } else {
            await query('INSERT INTO restaurants (id, name, cuisine, operating_hours, menu) VALUES ($1, $2, $3, $4, $5)', [`rest_${Date.now()}`, r.name, r.cuisine, r.operatingHours, r.menu]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.delete('/api/restaurants/:id', authenticate, requirePermission('manage_dining'), async (req: any, res: any) => {
    await query('DELETE FROM restaurants WHERE id = $1', [req.params.id]);
    res.json({ success: true });
} as any);

// Add Reservation (Admin)
app.post('/api/admin/dining/reservations', authenticate, requirePermission('manage_dining'), async (req: any, res: any) => {
    const { restaurantId, delegateId, reservationTime, partySize } = req.body;
    try {
        const userResult = await query('SELECT name FROM registrations WHERE id = $1', [delegateId]);
        const delegateName = userResult.rows[0]?.name || 'Unknown';
        
        await query('INSERT INTO dining_reservations (id, restaurant_id, delegate_id, delegate_name, reservation_time, party_size) VALUES ($1, $2, $3, $4, $5, $6)', 
            [`res_${Date.now()}`, restaurantId, delegateId, delegateName, reservationTime, partySize]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);

// Delete Reservation
app.delete('/api/dining/reservations/:id', authenticate, requirePermission('manage_dining'), async (req: any, res: any) => {
    await query('DELETE FROM dining_reservations WHERE id = $1', [req.params.id]);
    res.json({ success: true });
} as any);

// --- Engagement (Scavenger Hunt) ---
app.get('/api/scavenger-hunt-items', async (req: any, res: any) => {
    try {
        const result = await query('SELECT * FROM scavenger_hunt_items');
        // Hide secret code if not admin (check handled by client logic but secure here if needed)
        res.json(result.rows);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.post('/api/scavenger-hunt-items', authenticate, requirePermission('manage_settings'), async (req: any, res: any) => {
    const i = req.body;
    try {
        if (i.id) {
            await query('UPDATE scavenger_hunt_items SET name=$1, hint=$2, reward_amount=$3, secret_code=$4 WHERE id=$5', [i.name, i.hint, i.rewardAmount, i.secretCode, i.id]);
        } else {
            await query('INSERT INTO scavenger_hunt_items (id, name, hint, reward_amount, secret_code) VALUES ($1, $2, $3, $4, $5)', [`hunt_${Date.now()}`, i.name, i.hint, i.rewardAmount, i.secretCode]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.delete('/api/scavenger-hunt-items/:id', authenticate, requirePermission('manage_settings'), async (req: any, res: any) => {
    await query('DELETE FROM scavenger_hunt_items WHERE id = $1', [req.params.id]);
    res.json({ success: true });
} as any);
app.get('/api/scavenger-hunt/progress', authenticate, async (req: any, res: any) => {
    try {
        const result = await query('SELECT item_id FROM scavenger_hunt_logs WHERE user_id = $1', [req.user.id]);
        res.json(result.rows.map(r => r.item_id));
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.post('/api/scavenger-hunt/claim', authenticate, async (req: any, res: any) => {
    const { secretCode } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const itemResult = await client.query('SELECT * FROM scavenger_hunt_items WHERE secret_code = $1', [secretCode]);
        const item = itemResult.rows[0];
        if (!item) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Invalid Code" });
        }

        const logCheck = await client.query('SELECT * FROM scavenger_hunt_logs WHERE user_id = $1 AND item_id = $2', [req.user.id, item.id]);
        if (logCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Already claimed" });
        }

        await client.query('INSERT INTO scavenger_hunt_logs (id, user_id, item_id, timestamp) VALUES ($1, $2, $3, $4)', [`hl_${Date.now()}`, req.user.id, item.id, Date.now()]);
        await client.query('INSERT INTO transactions (id, from_id, from_name, from_email, to_id, to_name, to_email, amount, message, type, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
            [`tx_rew_${Date.now()}`, 'system', 'System', 'system', req.user.id, req.user.email, req.user.email, item.reward_amount, `Found ${item.name}`, 'reward', Date.now()]
        );

        await client.query('COMMIT');
        logger.info(`Scavenger hunt claimed: ${req.user.email} found ${item.name}`);
        res.json({ success: true, message: `Earned ${item.reward_amount}`, rewardAmount: item.reward_amount });
    } catch (e) {
        await client.query('ROLLBACK');
        logger.error('Scavenger claim error', e);
        res.status(500).json({ message: 'Error' });
    } finally {
        client.release();
    }
} as any);
// Leaderboard
app.get('/api/scavenger-hunt/leaderboard', authenticate, async (req: any, res: any) => {
    try {
        const eventId = req.query.eventId || 'main-event';
        // Calculate leaderboard: Users with most items found (and score tie-breaker)
        const queryText = `
            SELECT r.id as "userId", r.name, 
                   COUNT(l.item_id) as "itemsFound", 
                   SUM(i.reward_amount) as score
            FROM registrations r
            JOIN scavenger_hunt_logs l ON r.id = l.user_id
            JOIN scavenger_hunt_items i ON l.item_id = i.id
            WHERE r.event_id = $1
            GROUP BY r.id, r.name
            ORDER BY score DESC, "itemsFound" DESC
            LIMIT 20
        `;
        const result = await query(queryText, [eventId]);
        // Ensure numbers are parsed correctly from strings
        const leaderboard = result.rows.map(row => ({
            userId: row.userId,
            name: row.name,
            itemsFound: parseInt(row.itemsFound),
            score: parseFloat(row.score)
        }));
        res.json(leaderboard);
    } catch (e) { 
        logger.error("Leaderboard error", e);
        res.status(500).json({ message: 'Error' }); 
    }
} as any);

// --- Networking ---
app.get('/api/networking/profile', authenticate, async (req: any, res: any) => {
    try {
        const result = await query('SELECT * FROM networking_profiles WHERE user_id = $1', [req.user.id]);
        res.json(result.rows[0] || null);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.post('/api/networking/profile', authenticate, async (req: any, res: any) => {
    const p = req.body;
    try {
        const check = await query('SELECT * FROM networking_profiles WHERE user_id = $1', [req.user.id]);
        if (check.rows.length > 0) {
            await query('UPDATE networking_profiles SET bio=$1, interests=$2, linkedin_url=$3, job_title=$4, company=$5, looking_for=$6, is_visible=$7 WHERE user_id=$8', [p.bio, JSON.stringify(p.interests), p.linkedinUrl, p.jobTitle, p.company, p.lookingFor, p.isVisible, req.user.id]);
        } else {
             await query('INSERT INTO networking_profiles (user_id, bio, interests, linkedin_url, job_title, company, looking_for, is_visible) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [req.user.id, p.bio, JSON.stringify(p.interests), p.linkedinUrl, p.jobTitle, p.company, p.lookingFor, p.isVisible]);
        }
        res.json(p);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);
app.get('/api/networking/candidates', authenticate, async (req: any, res: any) => {
    try {
        const result = await query('SELECT * FROM networking_profiles WHERE user_id != $1 AND is_visible = true', [req.user.id]);
        // Enrich with user names
        const profiles = [];
        for (const row of result.rows) {
             const userRes = await query('SELECT name FROM registrations WHERE id = $1', [row.user_id]);
             if (userRes.rows.length > 0) {
                 profiles.push({ ...row, name: userRes.rows[0].name });
             }
        }
        res.json(profiles);
    } catch (e) { res.status(500).json({ message: 'Error' }); }
} as any);

// Start Server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
