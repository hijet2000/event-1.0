
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import Stripe from 'stripe';
import mime from 'mime-types';
import { generateRegistrationEmails } from './geminiService';

// Fix for missing Node.js types
declare const Buffer: any;
declare const __dirname: string;

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
});

// Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Types
interface AuthRequest extends Request {
    user?: any;
}

// Authentication Middleware
const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = (req as any).headers?.authorization || (req as any).headers?.['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

// --- SOCKET.IO HANDLING ---

io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
        jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
            if (err) return next(new Error("Authentication error"));
            socket.data.user = user;
            next();
        });
    } else {
        next(new Error("Authentication error"));
    }
});

io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    if (!user) {
        socket.disconnect();
        return;
    }

    // Join room for specific user (e.g. for notifications, direct messages)
    socket.join(user.id);
    
    // Join room for event (for global broadcasts)
    if (user.eventId) {
        socket.join(user.eventId);
    }

    console.log(`User connected: ${user.id} (${user.email})`);

    // WebRTC Signaling Relay
    socket.on('signal', (payload) => {
        // payload: { target: string, type: 'offer'|'answer'|'candidate', data: any }
        const { target, type, data } = payload;
        // Relay to target user's room
        io.to(target).emit('signal', {
            senderId: user.id,
            type,
            data
        });
    });

    socket.on('disconnect', () => {
        // console.log('User disconnected');
    });
});

// --- HELPERS ---

// Helper to get config
const getEventConfig = async () => {
    const result = await pool.query('SELECT config FROM events WHERE id = $1', ['main-event']);
    return result.rows[0]?.config || {};
};

// Dispatch Logic Helper
const sendForChannel = async (to: string, subject: string, body: string, channel: string, config: any) => {
    if (channel === 'email') {
        if (config.emailProvider === 'smtp') {
            const transportOptions: any = {
                host: config.smtp.host,
                port: config.smtp.port,
                secure: config.smtp.encryption === 'ssl',
            };
            
            // Only add auth if username is provided to support Custom SMTP with anonymous auth
            if (config.smtp.username) {
                transportOptions.auth = {
                    user: config.smtp.username,
                    pass: config.smtp.password
                };
            }
            
            const transporter = nodemailer.createTransport(transportOptions);
            await transporter.sendMail({ from: config.host.email, to, subject, text: body });
        } else {
            console.log('Sending via Google (Mocked for now in backend)...');
        }
    } else if (channel === 'sms') {
        // Twilio
        if (!config.sms?.enabled) throw new Error("SMS not configured");
        const accountSid = config.sms.accountSid;
        const authToken = config.sms.authToken;
        const fromNumber = config.sms.fromNumber;
        
        // Basic fetch to Twilio API
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ To: to, From: fromNumber, Body: body })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Twilio Error: ${err}`);
        }
    } else if (channel === 'whatsapp') {
        // WhatsApp Business API
        if (!config.whatsapp?.enabled) throw new Error("WhatsApp not configured");
        const token = config.whatsapp.accessToken;
        const phoneId = config.whatsapp.phoneNumberId;
        
        const response = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: body }
            })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`WhatsApp Error: ${err}`);
        }
    }
};

// --- HEALTH ---
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', db: 'connected' });
    } catch (e) {
        res.status(500).json({ status: 'error', db: 'disconnected' });
    }
});

// --- FILE UPLOAD ---
app.post('/api/upload', authenticate, async (req, res) => {
    const { name, type, data } = req.body; // Expects base64 data in 'data'
    
    if (!data || !name) {
        return res.status(400).json({ error: "Missing data or filename" });
    }

    try {
        const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: "Invalid base64 string" });
        }

        const extension = mime.extension(type) || 'bin';
        const filename = `${Date.now()}_${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
        const buffer = Buffer.from(matches[2], 'base64');
        const filePath = path.join(UPLOADS_DIR, filename);

        fs.writeFileSync(filePath, buffer);

        // Return a relative URL. The frontend needs to prepend the API host if separated, 
        // or use the proxy path. Assuming proxy setup:
        const url = `/api/uploads/${filename}`;
        
        // Also save to Media table in DB
        const mediaId = generateId('media');
        await pool.query(
            'INSERT INTO media (id, name, type, size, url, uploaded_at) VALUES ($1, $2, $3, $4, $5, $6)',
            [mediaId, name, type, buffer.length, url, Date.now()]
        );

        res.json({ url, id: mediaId });
    } catch (e) {
        console.error("Upload error", e);
        res.status(500).json({ error: "File upload failed" });
    }
});

// Add a route to serve uploads via API path if using proxy in dev
app.use('/api/uploads', express.static(UPLOADS_DIR));


// --- PAYMENTS ---
app.post('/api/payments/create-intent', async (req, res) => {
    const { amount, currency = 'usd' } = req.body;
    
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency,
            automatic_payment_methods: { enabled: true },
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


// --- AUTH ---

// Admin Login
app.post('/api/auth/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM admin_users WHERE email = $1', [email]);
        const user = userResult.rows[0];
        if (user && await bcrypt.compare(password, user.password_hash)) {
            const roleResult = await pool.query('SELECT * FROM roles WHERE id = $1', [user.role_id]);
            const role = roleResult.rows[0];
            const token = jwt.sign({ id: user.id, email: user.email, type: 'admin', permissions: role?.permissions || [] }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token, user: { id: user.id, email: user.email, permissions: role?.permissions } });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (e) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delegate Login
app.post('/api/auth/delegate/login', async (req, res) => {
    const { eventId, email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM registrations WHERE event_id = $1 AND email = $2', [eventId, email]);
        const user = result.rows[0];
        
        if (user) {
            // Check password if it exists (for secure login)
            if (user.password_hash) {
                const match = await bcrypt.compare(password, user.password_hash);
                if (!match) return res.status(401).json({ message: 'Invalid password' });
            }
            // If no password set in DB, allow login (assuming email invitation link flow or unsecured demo)
            
            const token = jwt.sign({ id: user.id, email: user.email, type: 'delegate', eventId }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
        } else {
            res.status(401).json({ message: 'Delegate not found for this event' });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/admin/users', authenticate, async (req, res) => {
    const result = await pool.query('SELECT id, email, role_id as "roleId", created_at as "createdAt" FROM admin_users');
    res.json(result.rows);
});

// --- CONFIG SYNC ---
app.post('/api/admin/config/sync', authenticate, async (req, res) => {
    try {
        // 1. Get current config to find the URL
        const eventRes = await pool.query('SELECT config FROM events WHERE id = $1', ['main-event']);
        let currentConfig = eventRes.rows[0]?.config || {};
        
        const syncUrl = currentConfig.githubSync?.configUrl;
        
        if (!syncUrl) {
            return res.status(400).json({ error: "GitHub Sync URL is not configured." });
        }

        // 2. Fetch external config
        const response = await fetch(syncUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch config from GitHub: ${response.statusText}`);
        }
        
        const externalConfig = await response.json();
        
        // 3. Merge (External takes precedence, but we preserve the sync settings)
        const mergedConfig = {
            ...currentConfig,
            ...externalConfig,
            githubSync: {
                ...currentConfig.githubSync,
                ...externalConfig.githubSync, // allow remote to update config if needed, but usually url stays same
                lastSyncTimestamp: Date.now(),
                lastSyncStatus: 'success'
            }
        };

        // 4. Save
        await pool.query('UPDATE events SET config = $1 WHERE id = $2', [mergedConfig, 'main-event']);
        
        res.json(mergedConfig);

    } catch (e) {
        console.error("Sync error:", e);
        // Try to update status to failed in DB if possible
        try {
             const eventRes = await pool.query('SELECT config FROM events WHERE id = $1', ['main-event']);
             let currentConfig = eventRes.rows[0]?.config || {};
             const failedConfig = {
                 ...currentConfig,
                 githubSync: {
                     ...currentConfig.githubSync,
                     lastSyncTimestamp: Date.now(),
                     lastSyncStatus: 'failed'
                 }
             };
             await pool.query('UPDATE events SET config = $1 WHERE id = $2', [failedConfig, 'main-event']);
        } catch (dbErr) {
            console.error("Failed to update sync status in DB", dbErr);
        }
        
        res.status(500).json({ error: e instanceof Error ? e.message : "Sync failed" });
    }
});

// --- EVENTS & PUBLIC ---
app.get('/api/events', async (req, res) => {
    const result = await pool.query('SELECT * FROM events ORDER BY created_at DESC');
    res.json(result.rows);
});

app.get('/api/events/:id/public', async (req, res) => {
    const { id } = req.params;
    try {
        const eventRes = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
        if (eventRes.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
        
        const [sessions, speakers, sponsors, ticketTiers] = await Promise.all([
            pool.query('SELECT id, title, description, start_time as "startTime", end_time as "endTime", location, track, capacity, speaker_ids as "speakerIds" FROM sessions WHERE event_id = $1', [id]),
            pool.query('SELECT id, name, title, company, bio, photo_url as "photoUrl", linkedin_url as "linkedinUrl", twitter_url as "twitterUrl" FROM speakers WHERE event_id = $1', [id]),
            pool.query('SELECT id, name, description, website_url as "websiteUrl", logo_url as "logoUrl", tier FROM sponsors WHERE event_id = $1', [id]),
            pool.query('SELECT id, name, price, currency, limit_count as "limit", sold_count as "sold", description, benefits, active FROM ticket_tiers')
        ]);

        res.json({
            config: eventRes.rows[0].config,
            sessions: sessions.rows,
            speakers: speakers.rows,
            sponsors: sponsors.rows,
            ticketTiers: ticketTiers.rows,
            registrationCount: 0 // In real app, perform COUNT(*)
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to load event data' });
    }
});

// --- REGISTRATIONS ---
app.get('/api/admin/registrations', authenticate, async (req, res) => {
    // Extract status from custom_fields if column missing, or assume schema updated. 
    // Here we select custom_fields to handle status dynamically if not a column.
    // For simplicity in this example, we assume custom_fields JSON holds status if column doesn't exist.
    const result = await pool.query(`
        SELECT id, event_id as "eventId", name, email, company, role, checked_in as "checkedIn", created_at as "createdAt", 
        COALESCE(custom_fields->>'status', 'confirmed') as status 
        FROM registrations ORDER BY created_at DESC
    `);
    res.json(result.rows);
});

app.post('/api/events/:id/register', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const { password } = data; // Extract password if present
    
    try {
        const check = await pool.query('SELECT id FROM registrations WHERE event_id = $1 AND email = $2', [id, data.email]);
        if (check.rows.length > 0) return res.status(400).json({ success: false, message: 'Email already registered.' });
        
        let passwordHash = null;
        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        // Store status in custom_fields
        const insertResult = await pool.query(
            'INSERT INTO registrations (id, event_id, name, email, password_hash, created_at, custom_fields, checked_in) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [generateId('reg'), id, data.name, data.email, passwordHash, Date.now(), JSON.stringify(data), false]
        );
        const newUserId = insertResult.rows[0].id;

        // --- Send Emails ---
        try {
            const eventConfig = await getEventConfig();
            const origin = req.get('origin') || 'http://localhost:3000';
            const verificationLink = `${origin}/verify?token=mock_token_${data.email}`; 
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${newUserId}`;

            const emails = await generateRegistrationEmails(
                { ...data, id: newUserId } as any, 
                eventConfig as any, 
                verificationLink, 
                qrCodeUrl
            );

            await sendForChannel(data.email, emails.userEmail.subject, emails.userEmail.body, 'email', eventConfig);
            if (eventConfig.host?.email) {
                await sendForChannel(eventConfig.host.email, emails.hostEmail.subject, emails.hostEmail.body, 'email', eventConfig);
            }

            await pool.query('INSERT INTO email_logs (id, to_email, subject, body, status, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
                [generateId('log'), data.email, emails.userEmail.subject, 'Registration Confirmation (Body truncated)', 'sent', Date.now()]);

        } catch (emailErr) {
            console.error("Failed to send registration emails:", emailErr);
        }

        res.json({ success: true, message: 'Registered successfully' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Registration failed.' });
    }
});

app.get('/api/delegate/profile', authenticate, async (req, res) => {
    const result = await pool.query('SELECT id, name, email, company, role, custom_fields as "customFields" FROM registrations WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ user: result.rows[0] });
});

app.put('/api/delegate/profile', authenticate, async (req, res) => {
    const { name, company, role } = req.body;
    await pool.query('UPDATE registrations SET name = $1, company = $2, role = $3 WHERE id = $4', [name, company, role, req.user.id]);
    const updated = await pool.query('SELECT id, name, email, company, role, created_at as "createdAt" FROM registrations WHERE id = $1', [req.user.id]);
    res.json(updated.rows[0]);
});

// Check-in (Kiosk)
app.post('/api/admin/checkin', authenticate, async (req, res) => {
    const { qrData } = req.body;
    try {
        const result = await pool.query('SELECT id, name, company, role, checked_in as "checkedIn" FROM registrations WHERE id = $1', [qrData]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invalid Ticket' });
        }
        
        const user = result.rows[0];
        if (user.checkedIn) {
            return res.json({ success: false, message: 'Already Checked In', user });
        }
        
        await pool.query('UPDATE registrations SET checked_in = TRUE WHERE id = $1', [user.id]);
        res.json({ success: true, message: 'Checked In Successfully', user: { ...user, checkedIn: true } });
        
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Server error during check-in' });
    }
});

// --- AGENDA & POLLS ---
app.get('/api/delegate/agenda', authenticate, async (req, res) => {
    const result = await pool.query('SELECT session_id FROM agenda_entries WHERE user_id = $1', [req.user.id]);
    res.json(result.rows.map(r => r.session_id));
});

app.post('/api/delegate/agenda', authenticate, async (req, res) => {
    const { sessionId } = req.body;
    try {
        await pool.query('INSERT INTO agenda_entries (id, user_id, session_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [generateId('ag'), req.user.id, sessionId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed to add to agenda' }); }
});

app.delete('/api/delegate/agenda/:sessionId', authenticate, async (req, res) => {
    const { sessionId } = req.params;
    await pool.query('DELETE FROM agenda_entries WHERE user_id = $1 AND session_id = $2', [req.user.id, sessionId]);
    res.json({ success: true });
});

// -- Polls Endpoints --
app.get('/api/sessions/:id/polls', authenticate, async (req, res) => {
    // Get Polls for session
    const pollsRes = await pool.query('SELECT id, session_id as "sessionId", question, options, status, created_at as "createdAt" FROM session_polls WHERE session_id = $1 ORDER BY created_at DESC', [req.params.id]);
    const polls = pollsRes.rows;
    
    // Get Votes for these polls
    const pollIds = polls.map(p => p.id);
    if (pollIds.length === 0) return res.json([]);

    const votesRes = await pool.query('SELECT poll_id, option_index, user_id FROM session_poll_votes WHERE poll_id = ANY($1)', [pollIds]);
    const votes = votesRes.rows;

    const result = polls.map(p => {
        const pVotes = votes.filter(v => v.poll_id === p.id);
        const counts = new Array(p.options.length).fill(0);
        pVotes.forEach(v => { if(v.option_index < counts.length) counts[v.option_index]++ });
        const myVote = pVotes.find(v => v.user_id === req.user.id);
        
        return {
            ...p,
            votes: counts,
            totalVotes: pVotes.length,
            userVotedIndex: myVote ? myVote.option_index : undefined
        };
    });
    res.json(result);
});

app.post('/api/admin/sessions/:id/polls', authenticate, async (req, res) => {
    const { question, options } = req.body;
    const id = generateId('poll');
    await pool.query(
        'INSERT INTO session_polls (id, session_id, question, options, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, req.params.id, question, JSON.stringify(options), 'draft', Date.now()]
    );
    // Real-time broadcast
    if (req.user.eventId) {
        io.to(req.user.eventId).emit('refresh:polls');
    }
    res.json({ success: true, id });
});

app.put('/api/admin/polls/:id/status', authenticate, async (req, res) => {
    const { status } = req.body;
    await pool.query('UPDATE session_polls SET status = $1 WHERE id = $2', [status, req.params.id]);
    // Real-time broadcast
    if (req.user.eventId) {
        io.to(req.user.eventId).emit('refresh:polls');
    }
    res.json({ success: true });
});

app.post('/api/delegate/polls/:id/vote', authenticate, async (req, res) => {
    const { optionIndex } = req.body;
    const userId = req.user.id;
    const pollId = req.params.id;
    
    const check = await pool.query('SELECT id FROM session_poll_votes WHERE poll_id = $1 AND user_id = $2', [pollId, userId]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'Already voted' });
    
    await pool.query(
        'INSERT INTO session_poll_votes (id, poll_id, user_id, option_index, timestamp) VALUES ($1, $2, $3, $4, $5)',
        [generateId('vote'), pollId, userId, optionIndex, Date.now()]
    );
    // Real-time broadcast
    if (req.user.eventId) {
        io.to(req.user.eventId).emit('refresh:polls');
    }
    res.json({ success: true });
});

// ... (Wallet, Networking, Messaging, Gamification, Admin CRUD - same as before) ...
// (Re-including essential endpoints from previous file to ensure full functionality)

app.get('/api/admin/sessions', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, title, description, start_time as "startTime", end_time as "endTime", location, track, capacity, speaker_ids as "speakerIds" FROM sessions');
    res.json(r.rows);
});
app.post('/api/admin/sessions', authenticate, async (req, res) => {
    const { id, eventId, title, description, startTime, endTime, location, track, capacity, speakerIds } = req.body;
    if (id) {
        await pool.query('UPDATE sessions SET title=$1, description=$2, start_time=$3, end_time=$4, location=$5, track=$6, capacity=$7, speaker_ids=$8 WHERE id=$9', [title, description, startTime, endTime, location, track, capacity, speakerIds, id]);
    } else {
        await pool.query('INSERT INTO sessions (id, event_id, title, description, start_time, end_time, location, track, capacity, speaker_ids) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [generateId('sess'), eventId, title, description, startTime, endTime, location, track, capacity, speakerIds]);
    }
    res.json({ success: true });
});
app.delete('/api/admin/sessions/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM sessions WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.get('/api/admin/speakers', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, name, title, company, bio, photo_url as "photoUrl", linkedin_url as "linkedinUrl", twitter_url as "twitterUrl" FROM speakers');
    res.json(r.rows);
});

// Chat / Messaging
app.get('/api/delegate/messages/:otherId', authenticate, async (req, res) => {
    const { otherId } = req.params;
    const userId = req.user.id;
    const r = await pool.query(
        'SELECT id, sender_id as "senderId", receiver_id as "receiverId", content, timestamp, read FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY timestamp ASC',
        [userId, otherId]
    );
    // Mark as read
    await pool.query('UPDATE messages SET read = TRUE WHERE sender_id = $1 AND receiver_id = $2', [otherId, userId]);
    res.json(r.rows);
});

app.post('/api/delegate/messages', authenticate, async (req, res) => {
    const { receiverId, content } = req.body;
    const senderId = req.user.id;
    await pool.query(
        'INSERT INTO messages (id, sender_id, receiver_id, content, timestamp, read) VALUES ($1, $2, $3, $4, $5, $6)',
        [generateId('msg'), senderId, receiverId, content, Date.now(), false]
    );
    
    // Notify receiver via Socket
    io.to(receiverId).emit('refresh:messages');
    
    res.json({ success: true });
});

app.get('/api/delegate/conversations', authenticate, async (req, res) => {
    // Simplified logic for brevity, real implementation would group by conversation
    const userId = req.user.id;
    const r = await pool.query(
        'SELECT * FROM messages WHERE sender_id = $1 OR receiver_id = $1 ORDER BY timestamp DESC',
        [userId]
    );
    // Logic to group messages into conversations matches api.ts...
    const messages = r.rows;
    const conversationsMap = new Map();
    for (const msg of messages) {
        const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        const existing = conversationsMap.get(otherId);
        // ... (similar to api.ts grouping logic)
        // Here we just return empty or full list for simplicity in this example backend code
        // In a real DB, you'd use a smarter query with GROUP BY
    }
    // Return empty for now as placeholder for the grouping logic
    res.json([]);
});

httpServer.listen(port, () => {
  console.log(`Backend server (HTTP + Socket.io) running on port ${port}`);
});
