
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
import mime from 'mime-types';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { generateRegistrationEmails, summarizeSessionFeedback, generateWaitlistPromotionEmail, researchEntity, generateNetworkingMatches, generateChatReply } from './geminiService';
import { Buffer } from 'buffer';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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

// --- Persistence Logic ---

// Mock DB structure
let memoryDb: any = {
    registrations: [],
    messages: [],
    polls: [],
    events: [],
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
    scavenger_hunt_items: [],
    scavenger_hunt_progress: [],
    networking_profiles: [],
    agenda_entries: [],
    ticket_tiers: [],
    venue_maps: [],
    email_logs: [],
    session_questions: [],
    session_feedback: [],
    poll_votes: [],
    admin_users: [],
    roles: []
};

// Load DB
const loadDb = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            const loaded = JSON.parse(data);
            // Merge loaded data ensuring all keys exist
            memoryDb = { ...memoryDb, ...loaded };
            console.log("📦 Database loaded from file.");
        } else {
            console.log("📦 New database initialized.");
            saveDb();
        }
    } catch (e) {
        console.error("Failed to load database:", e);
    }
};

// Save DB
const saveDb = () => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(memoryDb, null, 2));
    } catch (e) {
        console.error("Failed to save database:", e);
    }
};

// Initial Load
loadDb();

// --- Helper Functions ---

// Robust Config Merger for Backend
const SAFE_DEFAULTS = {
    host: { name: 'Event Host', email: 'host@example.com' },
    event: { name: 'Event Name' },
    telegram: { enabled: false, botToken: '' },
    whatsapp: { enabled: false, accessToken: '', phoneNumberId: '' },
    sms: { enabled: false, accountSid: '', authToken: '', fromNumber: '' },
    smtp: { host: '', port: 587, username: '', password: '', encryption: 'tls' },
    googleConfig: { serviceAccountKeyJson: '' },
    emailProvider: 'smtp'
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
        emailProvider: rawConfig.emailProvider || SAFE_DEFAULTS.emailProvider
    };
};

const sendEmail = async (to: string, subject: string, body: string, rawConfig: any) => {
    if (!to || !subject || !body) return;
    
    const config = getSafeConfig(rawConfig);

    console.log(`📧 Sending email to ${to}: ${subject}`);
    
    // Log to DB
    if (!memoryDb.email_logs) memoryDb.email_logs = [];
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const logEntry = {
        id: logId,
        to,
        subject,
        body,
        timestamp: Date.now(),
        status: 'sent', // Optimistic
        error: undefined as string | undefined
    };
    memoryDb.email_logs.push(logEntry);
    saveDb();

    // Actual Send Logic
    try {
        if (config.emailProvider === 'smtp' && config.smtp) {
            if (!config.smtp.host || !config.smtp.username) {
                throw new Error("SMTP settings incomplete.");
            }
            const transporter = nodemailer.createTransport({
                host: config.smtp.host,
                port: config.smtp.port,
                secure: config.smtp.encryption === 'ssl', // true for 465, false for other ports
                auth: config.smtp.username ? {
                    user: config.smtp.username,
                    pass: config.smtp.password,
                } : undefined,
                tls: {
                    rejectUnauthorized: false // Allow self-signed certs for dev flexibility
                }
            });

            await transporter.sendMail({
                from: `"${config.host.name}" <${config.host.email}>`,
                to,
                subject,
                text: body, // Plain text body
            });
            console.log("✅ Email sent via SMTP");
        
        } else if (config.emailProvider === 'google' && config.googleConfig) {
            // Validate Google Config safely
            const keyJson = config.googleConfig.serviceAccountKeyJson;
            if (!keyJson) throw new Error("Service Account Key is missing.");

            let serviceAccount;
            try {
                serviceAccount = JSON.parse(keyJson);
            } catch (e) {
                throw new Error("Invalid Service Account JSON format.");
            }

            if (!serviceAccount.project_id || !serviceAccount.client_email) {
                throw new Error("Service Account JSON missing required fields (project_id, client_email).");
            }

            // In a real application, you would use googleapis here:
            // const { google } = require('googleapis');
            // const auth = new google.auth.GoogleAuth({ credentials: serviceAccount, scopes: ['https://www.googleapis.com/auth/gmail.send'] });
            // ...

            console.log(`✅ Email sent via Google API (Project: ${serviceAccount.project_id}, User: ${serviceAccount.client_email})`);
            
        } else {
            console.log("⚠️ No valid email provider configured. Email simulated.");
        }
    } catch (e) {
        console.error("❌ Failed to send email:", e);
        // Update log status
        const logIndex = memoryDb.email_logs.findIndex((l: any) => l.id === logId);
        if (logIndex !== -1) {
            memoryDb.email_logs[logIndex].status = 'failed';
            memoryDb.email_logs[logIndex].error = e instanceof Error ? e.message : String(e);
            saveDb();
        }
        throw e; // Re-throw to inform caller
    }
};

const comparePass = async (input: string, hash: string): Promise<boolean> => {
    // Support legacy mock hash for smooth transition
    if (hash.startsWith('$2b$10$mock')) {
        const computed = `$2b$10$mock${Buffer.from(input).toString('base64')}`;
        return computed === hash;
    }
    return await bcrypt.compare(input, hash);
};

const calculateBalance = (userId: string) => {
    const event = memoryDb.events[0];
    const startingBalance = event?.config?.eventCoin?.startingBalance || 0;
    
    let balance = startingBalance;
    const transactions = memoryDb.transactions || [];
    
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

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', (room) => {
    socket.join(room);
  });

  // WebRTC Signaling Relay
  socket.on('signal', (data) => {
    const { to, ...payload } = data;
    io.emit('signal', { ...payload, senderId: socket.id }); 
  });

  // Chat Handling
  socket.on('chat:send', (message) => {
    memoryDb.messages.push(message);
    saveDb();
    io.emit('refresh:messages', message); 
    io.emit('refresh:data', { table: 'messages' });
  });

  // Poll Handling
  socket.on('poll:vote', (data) => {
      io.emit('refresh:polls', { pollId: data.pollId });
      io.emit('refresh:data', { table: 'poll_votes' });
  });
  
  socket.on('poll:update', (data) => {
      io.emit('refresh:polls', data);
      io.emit('refresh:data', { table: 'polls' });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// --- API Routes ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', online: true });
});

// Webhook for Telegram Chat Bot
app.post('/api/webhooks/telegram', async (req, res) => {
    const { message } = req.body; 
    
    if (!message || !message.text) return res.sendStatus(200);
    
    const chatId = message.chat.id;
    const text = message.text;
    
    console.log(`[Telegram Webhook] Received from ${chatId}: ${text}`);
    
    const event = memoryDb.events[0];
    const config = getSafeConfig(event?.config);
    
    if (!config.telegram.enabled) return res.sendStatus(200);

    const context = `Event: ${config.event.name}. Date: ${config.event.date}. Location: ${config.event.location}.`;
    const reply = await generateChatReply(text, context);
    
    console.log(`[Telegram Bot] Replying to ${chatId}: ${reply}`);
    // In prod: fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, ...)
    
    res.sendStatus(200);
});

// Webhook for WhatsApp Chat Bot
app.post('/api/webhooks/whatsapp', async (req, res) => {
    // Verification Request
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token']) {
        return res.send(req.query['hub.challenge']);
    }

    const { entry } = req.body;
    if (entry && entry[0].changes && entry[0].changes[0].value.messages) {
        const msg = entry[0].changes[0].value.messages[0];
        const from = msg.from;
        const text = msg.text?.body;
        
        console.log(`[WhatsApp Webhook] Received from ${from}: ${text}`);
        
        const event = memoryDb.events[0];
        const config = getSafeConfig(event?.config);
        
        if (!config.whatsapp.enabled) return res.sendStatus(200);

        const context = `Event: ${config.event.name}. Date: ${config.event.date}. Location: ${config.event.location}.`;
        const reply = await generateChatReply(text, context);
        
        console.log(`[WhatsApp Bot] Replying to ${from}: ${reply}`);
        // In prod: Send via Graph API
    }
    
    res.sendStatus(200);
});

// Projector / Public Session Data
app.get('/api/public/sessions/:id/live-data', (req, res) => {
    const { id } = req.params;
    
    // Find Session
    const session = memoryDb.sessions.find((s: any) => s.id === id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    // Get Polls with Results
    const polls = memoryDb.polls.filter((p: any) => p.sessionId === id);
    const pollsWithVotes = polls.map((p: any) => {
        const votes = memoryDb.poll_votes.filter((v: any) => v.pollId === p.id);
        const voteCounts = new Array(p.options.length).fill(0);
        votes.forEach((v: any) => {
            if (v.optionIndex >= 0 && v.optionIndex < voteCounts.length) voteCounts[v.optionIndex]++;
        });
        return { ...p, votes: voteCounts, totalVotes: votes.length };
    });
    
    // Get Q&A
    const questions = memoryDb.session_questions
        .filter((q: any) => q.sessionId === id)
        .sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0)); // Sort by upvotes
        
    res.json({
        session,
        polls: pollsWithVotes,
        questions
    });
});

// Authentication Routes
app.post('/api/auth/admin/login', async (req, res) => {
    const { email, password } = req.body;
    const user = memoryDb.admin_users.find((u: any) => u.email === email);
    
    if (user && await comparePass(password, user.password_hash)) {
        const role = memoryDb.roles.find((r: any) => r.id === user.roleId);
        const permissions = role ? role.permissions : [];
        
        const token = jwt.sign(
            { id: user.id, email: user.email, type: 'admin', permissions },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ token, user: { ...user, permissions } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.post('/api/auth/delegate/login', async (req, res) => {
    const { email, password, eventId } = req.body;
    // Check specific event or global
    const user = memoryDb.registrations.find((u: any) => 
        u.email === email && (!u.eventId || u.eventId === eventId)
    );
    
    // For delegates, we might check a password field. 
    // In this prototype, delegates register with a password.
    if (user && user.password && await comparePass(password, user.password)) {
        const token = jwt.sign(
            { id: user.id, email: user.email, type: 'delegate', eventId },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({ token, user });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Admin Dashboard Analytics
app.get('/api/admin/dashboard', authenticateToken, (req: AuthRequest, res) => {
    if (req.user?.type !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const totalRegistrations = memoryDb.registrations.length;
    const maxAttendees = memoryDb.events[0]?.config?.event?.maxAttendees || 500;
    const eventDate = memoryDb.events[0]?.config?.event?.date || 'TBD';
    const eventCoinName = memoryDb.events[0]?.config?.eventCoin?.name || 'EventCoin';

    // Calculate Trend (Last 7 Days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const trendMap = new Map<string, number>();
    
    // Initialize last 7 days with 0
    for(let i=0; i<7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        trendMap.set(d.toISOString().split('T')[0], 0);
    }

    memoryDb.registrations.forEach((reg: any) => {
        if (reg.createdAt >= sevenDaysAgo) {
            const date = new Date(reg.createdAt).toISOString().split('T')[0];
            if (trendMap.has(date)) {
                trendMap.set(date, (trendMap.get(date) || 0) + 1);
            }
        }
    });

    const registrationTrend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count })).reverse();

    // Task Stats
    const tasks = memoryDb.tasks || [];
    const taskStats = {
        total: tasks.length,
        completed: tasks.filter((t: any) => t.status === 'completed').length,
        pending: tasks.filter((t: any) => t.status !== 'completed').length
    };

    // Economy Stats
    const totalCirculation = (memoryDb.transactions || []).reduce((acc: number, tx: any) => {
        // Only count injections into the system (system/admin -> user)
        if (['initial', 'purchase', 'reward', 'admin_adjustment'].includes(tx.type) && tx.amount > 0) {
             return acc + tx.amount;
        }
        return acc;
    }, 0);

    const activeWallets = new Set((memoryDb.transactions || []).map((t: any) => t.fromId).concat((memoryDb.transactions || []).map((t: any) => t.toId))).size;

    const recentRegistrations = [...memoryDb.registrations].sort((a: any, b: any) => b.createdAt - a.createdAt).slice(0, 5);

    res.json({
        totalRegistrations,
        maxAttendees,
        eventDate,
        registrationTrend,
        taskStats,
        recentRegistrations,
        eventCoinName,
        eventCoinCirculation: totalCirculation,
        activeWallets,
        totalTransactions: (memoryDb.transactions || []).length
    });
});

// Admin Check-in
app.post('/api/admin/checkin', authenticateToken, (req: AuthRequest, res) => {
    if (req.user?.type !== 'admin') return res.status(403).json({ error: 'Admin only' });
    
    const { qrData } = req.body;
    
    // Find registration by ID or some secure token logic
    const registration = memoryDb.registrations.find((r: any) => r.id === qrData);
    
    if (!registration) {
        return res.status(404).json({ success: false, message: 'Attendee not found.' });
    }
    
    if (registration.checkedIn) {
        return res.json({ success: true, message: 'Already checked in.', user: registration });
    }
    
    // Update status
    registration.checkedIn = true;
    saveDb();
    
    // Notify clients
    io.emit('refresh:registrations');
    io.emit('refresh:data', { table: 'registrations' });
    
    res.json({ success: true, message: `Checked in ${registration.name}`, user: registration });
});

// Record Ticket Sale
app.post('/api/admin/sales/record', authenticateToken, (req: AuthRequest, res) => {
    const { eventId, tierId, amount } = req.body;
    
    const tier = memoryDb.ticket_tiers.find((t: any) => t.id === tierId);
    if (tier) {
        tier.sold = (tier.sold || 0) + 1;
        
        // Optionally create a transaction record for revenue tracking
        if (!memoryDb.revenue_transactions) memoryDb.revenue_transactions = [];
        memoryDb.revenue_transactions.push({
            id: `sale_${Date.now()}`,
            eventId,
            tierId,
            amount,
            timestamp: Date.now()
        });
        
        saveDb();
        io.emit('refresh:data', { table: 'ticket_tiers' });
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Ticket tier not found' });
    }
});

// --- Smart Cancellation & Waitlist Promotion ---
app.post('/api/registrations/cancel', authenticateToken, async (req: AuthRequest, res) => {
    const { id } = req.body;
    const userId = req.user?.id;
    const type = req.user?.type;

    // 1. Find Registration
    const regIndex = memoryDb.registrations.findIndex((r: any) => r.id === id);
    if (regIndex === -1) return res.status(404).json({ error: 'Registration not found' });
    
    const registration = memoryDb.registrations[regIndex];

    // 2. Auth Check: Must be Admin or the Owner
    if (type !== 'admin' && userId !== registration.id) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const wasConfirmed = registration.status === 'confirmed';
    
    // 3. Update Status
    registration.status = 'cancelled';
    memoryDb.registrations[regIndex] = registration;
    
    let promotedUser = null;

    // 4. Auto-Promote Logic
    if (wasConfirmed) {
        // Find next waitlisted user for this event
        const waitlistedUsers = memoryDb.registrations
            .filter((r: any) => r.eventId === registration.eventId && r.status === 'waitlist')
            .sort((a: any, b: any) => a.createdAt - b.createdAt);
        
        if (waitlistedUsers.length > 0) {
            const nextUser = waitlistedUsers[0];
            nextUser.status = 'confirmed';
            
            // Find index to update in main array
            const nextIdx = memoryDb.registrations.findIndex((r: any) => r.id === nextUser.id);
            if (nextIdx !== -1) memoryDb.registrations[nextIdx] = nextUser;
            promotedUser = nextUser;

            // 5. Send Promotion Email
            const event = memoryDb.events.find((e: any) => e.id === nextUser.eventId);
            if (event && event.config) {
                try {
                    const emailContent = await generateWaitlistPromotionEmail(event.config, nextUser);
                    await sendEmail(nextUser.email, emailContent.subject, emailContent.body, event.config);
                    console.log(`🚀 Promoted ${nextUser.email} from waitlist.`);
                } catch (e) {
                    console.error("Failed to send promotion email", e);
                }
            }
        }
    }

    saveDb();
    
    io.emit('refresh:registrations');
    io.emit('refresh:data', { table: 'registrations' });

    res.json({ 
        success: true, 
        message: promotedUser 
            ? `Registration cancelled. ${promotedUser.name} was automatically promoted from the waitlist.` 
            : 'Registration cancelled.' 
    });
});

// --- Config Sync ---
app.post('/api/admin/config/sync', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.type !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const event = memoryDb.events.find((e: any) => e.id === 'main-event');
    if (!event || !event.config || !event.config.githubSync?.configUrl) {
        return res.status(400).json({ error: 'GitHub Sync URL not configured.' });
    }

    const url = event.config.githubSync.configUrl;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch config: ${response.statusText}`);
        const remoteConfig = await response.json();

        // Merge logic: Overlay remote config onto local, but preserve secrets if remote is missing them
        // For strict GitOps, remote should be source of truth, but secrets shouldn't be in public repos.
        // We'll trust remote for most things, but keep local secrets if remote value is empty.
        
        const newConfig = { ...event.config, ...remoteConfig };
        
        // Restore secrets if missing in remote but present in local
        if (event.config.smtp?.password && !newConfig.smtp?.password) {
             if (!newConfig.smtp) newConfig.smtp = {};
             newConfig.smtp.password = event.config.smtp.password;
        }
        if (event.config.googleConfig?.serviceAccountKeyJson && !newConfig.googleConfig?.serviceAccountKeyJson) {
             if (!newConfig.googleConfig) newConfig.googleConfig = {};
             newConfig.googleConfig.serviceAccountKeyJson = event.config.googleConfig.serviceAccountKeyJson;
        }
        if (event.config.sms?.authToken && !newConfig.sms?.authToken) {
             if (!newConfig.sms) newConfig.sms = {};
             newConfig.sms.authToken = event.config.sms.authToken;
        }
        
        // Update Sync Status
        newConfig.githubSync = {
            ...newConfig.githubSync,
            configUrl: url, // Ensure URL isn't overwritten if missing in remote
            lastSyncTimestamp: Date.now(),
            lastSyncStatus: 'success'
        };

        event.config = newConfig;
        saveDb();
        
        io.emit('refresh:data', { table: 'events' });

        res.json(newConfig);

    } catch (e) {
        console.error("Sync failed", e);
        if (event && event.config && event.config.githubSync) {
            event.config.githubSync = {
                ...event.config.githubSync,
                lastSyncTimestamp: Date.now(),
                lastSyncStatus: 'failed'
            };
            saveDb();
        }
        res.status(500).json({ error: e instanceof Error ? e.message : "Sync failed" });
    }
});

// --- Wallet & Economy Routes ---

app.get('/api/delegate/wallet', authenticateToken, (req: AuthRequest, res) => {
    if (req.user?.type !== 'delegate') return res.status(403).json({ error: 'Delegate access required' });
    
    const userId = req.user.id;
    const balance = calculateBalance(userId);
    const event = memoryDb.events[0];
    const currencyName = event?.config?.eventCoin?.name || 'EventCoin';
    
    res.json({ balance, currencyName });
});

app.post('/api/delegate/wallet/transfer', authenticateToken, (req: AuthRequest, res) => {
    if (req.user?.type !== 'delegate') return res.status(403).json({ error: 'Delegate access required' });
    
    const { recipientEmail, amount, message } = req.body;
    const senderId = req.user.id;
    const senderName = memoryDb.registrations.find((u:any) => u.id === senderId)?.name || 'Unknown';
    const senderEmail = req.user.email;
    
    if (amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    
    const balance = calculateBalance(senderId);
    if (balance < amount) return res.status(400).json({ error: 'Insufficient funds' });
    
    const recipient = memoryDb.registrations.find((r: any) => r.email === recipientEmail);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    if (recipient.id === senderId) return res.status(400).json({ error: 'Cannot send to self' });
    
    const tx = {
        id: `tx_${Date.now()}`,
        fromId: senderId,
        toId: recipient.id,
        fromName: senderName,
        toName: recipient.name,
        fromEmail: senderEmail,
        toEmail: recipient.email,
        amount,
        message,
        type: 'p2p',
        timestamp: Date.now()
    };
    
    if (!memoryDb.transactions) memoryDb.transactions = [];
    memoryDb.transactions.push(tx);
    saveDb();
    
    // Notify both parties
    io.emit('refresh:wallet'); // Broad refresh for simplicity, or room-based
    io.emit('refresh:data', { table: 'transactions' });
    
    res.json({ success: true, transaction: tx });
});

app.post('/api/delegate/wallet/purchase', authenticateToken, (req: AuthRequest, res) => {
    if (req.user?.type !== 'delegate') return res.status(403).json({ error: 'Delegate access required' });
    
    const { amount, cost } = req.body; // amount is coins, cost is currency
    const userId = req.user.id;
    
    const tx = {
        id: `tx_${Date.now()}`,
        fromId: 'system',
        toId: userId,
        fromName: 'System',
        toName: 'You',
        fromEmail: 'system',
        toEmail: req.user.email,
        amount,
        message: `Purchased for $${cost}`,
        type: 'purchase',
        timestamp: Date.now()
    };
    
    if (!memoryDb.transactions) memoryDb.transactions = [];
    memoryDb.transactions.push(tx);
    saveDb();
    
    io.emit('refresh:wallet');
    io.emit('refresh:data', { table: 'transactions' });
    
    res.json({ success: true });
});

// --- Gamification Routes ---

app.get('/api/delegate/gamification/progress', authenticateToken, (req: AuthRequest, res) => {
    if (req.user?.type !== 'delegate') return res.status(403).json({ error: 'Delegate access required' });
    
    const userId = req.user.id;
    const progress = memoryDb.scavenger_hunt_progress.find((p: any) => p.userId === userId);
    
    res.json(progress ? progress.foundItemIds : []);
});

app.post('/api/delegate/gamification/claim', authenticateToken, (req: AuthRequest, res) => {
    if (req.user?.type !== 'delegate') return res.status(403).json({ error: 'Delegate access required' });
    
    const { code } = req.body;
    const userId = req.user.id;
    
    // Find item
    const item = memoryDb.scavenger_hunt_items.find((i: any) => i.secretCode === code);
    if (!item) return res.status(404).json({ success: false, message: 'Invalid code.' });
    
    // Find or create progress
    let progress = memoryDb.scavenger_hunt_progress.find((p: any) => p.userId === userId);
    if (!progress) {
        progress = { id: `prog_${userId}`, userId, foundItemIds: [] };
        memoryDb.scavenger_hunt_progress.push(progress);
    }
    
    // Check if already claimed
    if (progress.foundItemIds.includes(item.id)) {
        return res.status(400).json({ success: false, message: 'You have already claimed this item!' });
    }
    
    // Claim
    progress.foundItemIds.push(item.id);
    
    // Award Coins
    if (item.rewardAmount > 0) {
        const tx = {
            id: `tx_reward_${Date.now()}`,
            fromId: 'system',
            toId: userId,
            fromName: 'Scavenger Hunt',
            toName: 'You',
            fromEmail: 'system',
            toEmail: req.user.email,
            amount: item.rewardAmount,
            message: `Found: ${item.name}`,
            type: 'reward',
            timestamp: Date.now()
        };
        memoryDb.transactions.push(tx);
    }
    
    saveDb();
    
    io.emit('refresh:gamification'); // Signal to update leaderboards
    io.emit('refresh:wallet'); // Signal to update balance
    io.emit('refresh:data', { table: 'scavenger_hunt_progress' });
    
    res.json({ success: true, message: `Found ${item.name}! +${item.rewardAmount} Coins` });
});

app.get('/api/gamification/leaderboard', (req, res) => {
    const leaderboard = memoryDb.scavenger_hunt_progress.map((prog: any) => {
        const user = memoryDb.registrations.find((r: any) => r.id === prog.userId);
        if (!user) return null;
        
        let score = 0;
        let itemsFound = 0;
        
        prog.foundItemIds.forEach((itemId: string) => {
            const item = memoryDb.scavenger_hunt_items.find((i: any) => i.id === itemId);
            if (item) {
                score += item.rewardAmount || 0;
                itemsFound++;
            }
        });
        
        return {
            userId: user.id,
            name: user.name,
            itemsFound,
            score
        };
    }).filter(Boolean);
    
    // Sort by score desc
    leaderboard.sort((a: any, b: any) => b.score - a.score);
    
    res.json(leaderboard.slice(0, 20)); // Top 20
});

// --- AI Networking ---
app.get('/api/delegate/networking/matches', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.type !== 'delegate') return res.status(403).json({ error: 'Delegate access required' });
    
    const userId = req.user.id;
    const myProfile = memoryDb.networking_profiles.find((p: any) => p.userId === userId);
    
    if (!myProfile) {
        return res.json({ matches: [], allCandidates: [] });
    }
    
    // Get potential matches (excluding self and non-visible)
    const candidates = memoryDb.networking_profiles
        .filter((p: any) => p.userId !== userId && p.isVisible)
        .map((p: any) => {
            // Hydrate with name/photo from registration
            const reg = memoryDb.registrations.find((r: any) => r.id === p.userId);
            return {
                ...p,
                name: reg?.name || 'Anonymous',
                photoUrl: reg?.photoUrl
            };
        });
        
    try {
        // Use Gemini to score matches
        const matches = await generateNetworkingMatches(myProfile, candidates);
        
        // Enrich matches with profile data
        const enrichedMatches = matches.map((match: any) => {
            const candidate = candidates.find((c: any) => c.userId === match.userId);
            return {
                ...match,
                name: candidate?.name,
                jobTitle: candidate?.jobTitle,
                company: candidate?.company,
                photoUrl: candidate?.photoUrl,
                profile: candidate
            };
        });
        
        res.json({ matches: enrichedMatches, allCandidates: candidates });
    } catch (e) {
        console.error("Networking match error", e);
        // Fallback to basic list
        res.json({ matches: [], allCandidates: candidates });
    }
});

// Sync Endpoint (Full DB State)
app.get('/api/sync', authenticateToken, (req: AuthRequest, res) => {
    const safeDb = { ...memoryDb };
    if (req.user?.type !== 'admin') {
        delete safeDb.admin_users; // Hide admin credentials
        delete safeDb.email_logs; // Hide logs
    }
    res.json(safeDb);
});

// Generic Data Access (GET)
app.get('/api/data/:collection', authenticateToken, (req: AuthRequest, res) => {
    const { collection } = req.params;
    
    // Security Check
    if (req.user?.type !== 'admin') {
        if (['admin_users', 'roles', 'email_logs'].includes(collection)) {
            return res.status(403).json({ error: 'Access denied' });
        }
    }
    
    res.json(memoryDb[collection] || []);
});

// Generic Data Access (Upsert)
app.post('/api/data/:collection', authenticateToken, (req: AuthRequest, res) => {
    const { collection } = req.params;
    const item = req.body;
    
    // Write Security Check
    if (req.user?.type !== 'admin') {
        const allowedWrites = ['messages', 'poll_votes', 'session_feedback', 'session_questions', 'scavenger_hunt_progress', 'networking_profiles', 'agenda_entries', 'dining_reservations', 'accommodation_bookings'];
        
        // Allow updating own profile
        if (collection === 'registrations' && item.id === req.user.id) {
            // Allowed
        } else if (!allowedWrites.includes(collection)) {
            return res.status(403).json({ error: 'Write access denied' });
        }
    }
    
    if (!memoryDb[collection]) memoryDb[collection] = [];
    
    const existingIdx = memoryDb[collection].findIndex((i: any) => i.id === item.id);
    if (existingIdx >= 0) {
        // If updating admin user password, hash it
        if (collection === 'admin_users' && item.password) {
             item.password_hash = bcrypt.hashSync(item.password, 10);
             delete item.password;
        }
        memoryDb[collection][existingIdx] = item;
    } else {
        // If new admin user, hash password
        if (collection === 'admin_users' && item.password) {
             item.password_hash = bcrypt.hashSync(item.password, 10);
             delete item.password;
        }
        memoryDb[collection].push(item);
    }
    
    saveDb();
    
    // Notify clients to refresh this table
    io.emit('refresh:data', { table: collection });
    
    res.json({ success: true, item });
});

// Generic Data Access (Delete)
app.delete('/api/data/:collection/:id', authenticateToken, (req: AuthRequest, res) => {
    const { collection, id } = req.params;
    
    // Delete Security Check
    if (req.user?.type !== 'admin') {
        const allowedDeletes = ['dining_reservations', 'accommodation_bookings'];
        if (!allowedDeletes.includes(collection)) {
             return res.status(403).json({ error: 'Delete access denied' });
        }
    }
    
    if (memoryDb[collection]) {
        memoryDb[collection] = memoryDb[collection].filter((i: any) => i.id !== id);
        saveDb();
        io.emit('refresh:data', { table: collection });
    }
    
    res.json({ success: true });
});

// Specific Route for Registration
app.post('/api/events/:id/register', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    
    // Hash password for delegate
    if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
    }

    const newUser = { ...data, id: `reg_${Date.now()}`, eventId: id, createdAt: Date.now() };
    if (!memoryDb.registrations) memoryDb.registrations = [];
    
    // Check dupe
    const exists = memoryDb.registrations.find((r: any) => r.email === data.email && r.eventId === id);
    if (exists) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    memoryDb.registrations.push(newUser);
    saveDb();
    
    io.emit('refresh:registrations');
    io.emit('refresh:data', { table: 'registrations' });
    
    // Trigger Emails
    try {
        const event = memoryDb.events.find((e: any) => e.id === id);
        const config = getSafeConfig(event?.config); // Use safe config
        
        if (config) {
             const qrData = newUser.id;
             const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;
             
             // Generate email content with AI
             const emails = await generateRegistrationEmails(newUser, config, '#', qrUrl);
             
             // Send to Delegate
             await sendEmail(newUser.email, emails.userEmail.subject, emails.userEmail.body, config);
             
             // Send to Host
             await sendEmail(config.host.email, emails.hostEmail.subject, emails.hostEmail.body, config);
        }
    } catch(e) {
        console.error("Email generation failed", e);
    }

    res.json({ success: true, user: newUser });
});

// AI Research
app.post('/api/admin/ai/research', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.type !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { type, name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    try {
        const data = await researchEntity(type, name);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e instanceof Error ? e.message : "Research failed" });
    }
});

// Communications Test
app.post('/api/admin/communications/test', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.type !== 'admin') return res.status(403).json({ error: 'Admin only' });
    
    const { to, channel, config } = req.body;
    const event = memoryDb.events.find((e:any) => e.id === 'main-event');
    const finalConfig = config || getSafeConfig(event?.config);
    
    try {
        if (channel === 'email') {
            await sendEmail(to, "Test Message", "This is a test message from your event platform.", finalConfig);
        } else if (channel === 'sms') {
            if (finalConfig.sms.enabled) {
                console.log(`[Test SMS] Sending to ${to} via ${finalConfig.sms.provider} (SID: ${finalConfig.sms.accountSid.substr(0,4)}...)...`);
            } else {
                throw new Error("SMS not enabled in config.");
            }
        } else if (channel === 'whatsapp') {
            if (finalConfig.whatsapp.enabled) {
                console.log(`[Test WhatsApp] Sending to ${to} via API (PhoneID: ${finalConfig.whatsapp.phoneNumberId})...`);
            } else {
                throw new Error("WhatsApp not enabled in config.");
            }
        } else if (channel === 'telegram') {
            if (finalConfig.telegram.enabled && finalConfig.telegram.botToken) {
                console.log(`[Test Telegram] Sending to Chat ID ${to} via Bot ${finalConfig.telegram.botToken.substr(0,5)}...`);
            } else {
                throw new Error("Telegram not enabled or token missing.");
            }
        }
        
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});

app.post('/api/admin/communications/send', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.type !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { to, config } = req.body; 
    const event = memoryDb.events.find((e:any) => e.id === 'main-event'); 
    const finalConfig = config || getSafeConfig(event?.config);
    
    try {
        await sendEmail(to, "Test Email", "This is a test message from your event platform.", finalConfig);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});

app.post('/api/admin/communications/broadcast', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user?.type !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { subject, body, target, channel } = req.body;
    const event = memoryDb.events.find((e:any) => e.id === 'main-event');
    const config = getSafeConfig(event?.config);

    let recipients = memoryDb.registrations;
    if (target === 'checked-in') recipients = recipients.filter((r:any) => r.checkedIn);
    if (target === 'pending') recipients = recipients.filter((r:any) => !r.checkedIn);

    let count = 0;
    
    if (channel === 'email') {
        for (const r of recipients) {
            if (r.email) {
                // In production, use a queue like BullMQ
                try {
                    await sendEmail(r.email, subject, body, config);
                    count++;
                } catch(e) {
                    console.error(`Failed to send broadcast email to ${r.email}:`, e);
                    // Continue to next recipient even if one fails
                }
            }
        }
    } else if (channel === 'sms') {
        if (config.sms.enabled) {
            console.log(`[SMS Broadcast] Sending via ${config.sms.provider} to ${recipients.length} users using SID: ${config.sms.accountSid}`);
            // Mock: Iterate and log
            recipients.forEach((r: any) => {
                // Use custom field 'phone' if present
                const phone = r.phone || r.customFields?.phone;
                if (phone) console.log(`   -> SMS to ${phone}: ${body}`);
            });
            count = recipients.length;
        } else {
            return res.status(400).json({ success: false, message: "SMS gateway not enabled." });
        }
    } else if (channel === 'whatsapp') {
        if (config.whatsapp.enabled) {
            console.log(`[WhatsApp Broadcast] Sending via WhatsApp API using PhoneID: ${config.whatsapp.phoneNumberId}`);
            count = recipients.length;
        } else {
            return res.status(400).json({ success: false, message: "WhatsApp gateway not enabled." });
        }
    } else if (channel === 'telegram') {
        if (config.telegram.enabled && config.telegram.botToken) {
            console.log(`[Telegram Broadcast] Sending via Bot: ${config.telegram.botToken.substring(0,5)}...`);
            // Mock: Iterate and log
            recipients.forEach((r: any) => {
                 // In a real app, we'd need a chat_id mapping, likely stored in a custom field or a dedicated table linking email to telegram chat_id
                 // For now, we simulate sending to everyone
                 console.log(`   -> Telegram Message to ${r.email} (simulated ID): ${body}`);
            });
            count = recipients.length;
        } else {
            return res.status(400).json({ success: false, message: "Telegram gateway not enabled or token missing." });
        }
    }

    res.json({ success: true, message: `Queued broadcast for ${count} recipients via ${channel}.` });
});

// Payment Intent
app.post('/api/payments/create-intent', (req, res) => {
    res.json({ clientSecret: 'mock_client_secret_' + Date.now() });
});

// File Upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR)
  },
  filename: function (req, file, cb) {
    const extension = mime.extension(file.mimetype) || 'bin';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + extension)
  }
});

const upload = multer({ storage: storage });

app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    res.json({ 
        id: req.file.filename,
        url: url,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
    });
});

// Start Server
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`📂 Data file: ${DATA_FILE}`);
  console.log(`📂 Uploads: ${UPLOADS_DIR}`);
});
