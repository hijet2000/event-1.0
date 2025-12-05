
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

// Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

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

// --- HEALTH ---
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', db: 'connected' });
    } catch (e) {
        res.status(500).json({ status: 'error', db: 'disconnected' });
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
    const result = await pool.query('SELECT id, event_id as "eventId", name, email, company, role, checked_in as "checkedIn", created_at as "createdAt" FROM registrations ORDER BY created_at DESC');
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

        await pool.query(
            'INSERT INTO registrations (id, event_id, name, email, password_hash, created_at, custom_fields, checked_in) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [generateId('reg'), id, data.name, data.email, passwordHash, Date.now(), JSON.stringify(data), false]
        );
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

// --- AGENDA (Delegate) ---
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

// --- WALLET (Delegate) ---
app.get('/api/delegate/balance', authenticate, async (req, res) => {
    const incoming = await pool.query('SELECT SUM(amount) as total FROM transactions WHERE to_id = $1', [req.user.id]);
    const outgoing = await pool.query('SELECT SUM(amount) as total FROM transactions WHERE from_id = $1', [req.user.id]);
    const balance = (parseFloat(incoming.rows[0].total) || 0) - (parseFloat(outgoing.rows[0].total) || 0) + 100; // Starting balance hardcoded for now
    res.json({ balance, currencyName: 'EventCoin' });
});

app.get('/api/delegate/transactions', authenticate, async (req, res) => {
    const result = await pool.query('SELECT id, from_id as "fromId", to_id as "toId", from_name as "fromName", to_name as "toName", amount, message, timestamp, type FROM transactions WHERE from_id = $1 OR to_id = $1 ORDER BY timestamp DESC', [req.user.id]);
    res.json(result.rows);
});

app.post('/api/delegate/pay', authenticate, async (req, res) => {
    const { toEmail, amount, message } = req.body;
    // Check balance
    // ... logic same as api.ts mock but with SQL ...
    const recipientRes = await pool.query('SELECT id, name, email FROM registrations WHERE email = $1', [toEmail]);
    if (recipientRes.rows.length === 0) return res.status(404).json({ error: 'Recipient not found' });
    const recipient = recipientRes.rows[0];
    
    const senderRes = await pool.query('SELECT name, email FROM registrations WHERE id = $1', [req.user.id]);
    const sender = senderRes.rows[0];

    await pool.query(
        'INSERT INTO transactions (id, from_id, to_id, from_name, to_name, from_email, to_email, amount, type, message, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [generateId('tx'), req.user.id, recipient.id, sender.name, recipient.name, sender.email, recipient.email, amount, 'p2p', message, Date.now()]
    );
    res.json({ success: true });
});

// --- NETWORKING (Delegate) ---
app.get('/api/delegate/networking/profile', authenticate, async (req, res) => {
    const result = await pool.query('SELECT user_id as "userId", job_title as "jobTitle", company, bio, interests, looking_for as "lookingFor", linkedin_url as "linkedinUrl", is_visible as "isVisible" FROM networking_profiles WHERE user_id = $1', [req.user.id]);
    res.json(result.rows[0] || null);
});

app.put('/api/delegate/networking/profile', authenticate, async (req, res) => {
    const { jobTitle, company, bio, interests, lookingFor, linkedinUrl, isVisible } = req.body;
    const existing = await pool.query('SELECT id FROM networking_profiles WHERE user_id = $1', [req.user.id]);
    if (existing.rows.length > 0) {
        await pool.query('UPDATE networking_profiles SET job_title=$1, company=$2, bio=$3, interests=$4, looking_for=$5, linkedin_url=$6, is_visible=$7 WHERE user_id=$8', 
            [jobTitle, company, bio, interests, lookingFor, linkedinUrl, isVisible, req.user.id]);
    } else {
        await pool.query('INSERT INTO networking_profiles (id, user_id, job_title, company, bio, interests, looking_for, linkedin_url, is_visible) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [generateId('np'), req.user.id, jobTitle, company, bio, interests, lookingFor, linkedinUrl, isVisible]);
    }
    res.json({ success: true });
});

app.get('/api/delegate/networking/candidates', authenticate, async (req, res) => {
    // Get other visible profiles
    const result = await pool.query(`
        SELECT p.user_id as "userId", p.job_title as "jobTitle", p.company, p.bio, p.interests, p.looking_for as "lookingFor", p.linkedin_url as "linkedinUrl", r.name 
        FROM networking_profiles p
        JOIN registrations r ON p.user_id = r.id
        WHERE p.user_id != $1 AND p.is_visible = TRUE
    `, [req.user.id]);
    
    const candidates = result.rows;
    // Basic Mock Matching Logic
    const matches = candidates.map((c: any) => ({
        userId: c.userId,
        name: c.name,
        jobTitle: c.jobTitle,
        company: c.company,
        score: Math.floor(Math.random() * 40) + 60,
        reason: "Shared interest in technology.",
        icebreaker: "Ask about " + c.company,
        profile: c
    }));
    
    res.json({ matches, allCandidates: candidates });
});

// --- MESSAGING (Delegate) ---
app.get('/api/delegate/conversations', authenticate, async (req, res) => {
    // Simple query to get unique participants from messages involving user
    const result = await pool.query(`
        SELECT DISTINCT 
            CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as other_id,
            MAX(timestamp) as last_timestamp
        FROM messages 
        WHERE sender_id = $1 OR receiver_id = $1
        GROUP BY other_id
        ORDER BY last_timestamp DESC
    `, [req.user.id]);
    
    const conversations = [];
    for (const row of result.rows) {
        const userRes = await pool.query('SELECT name FROM registrations WHERE id = $1', [row.other_id]);
        const lastMsgRes = await pool.query('SELECT content, read, sender_id FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY timestamp DESC LIMIT 1', [req.user.id, row.other_id]);
        
        // Count unread
        const unreadRes = await pool.query('SELECT COUNT(*) FROM messages WHERE sender_id = $1 AND receiver_id = $2 AND read = FALSE', [row.other_id, req.user.id]);
        
        conversations.push({
            withUserId: row.other_id,
            withUserName: userRes.rows[0]?.name || 'Unknown',
            lastMessage: lastMsgRes.rows[0]?.content || '',
            lastTimestamp: parseInt(row.last_timestamp),
            unreadCount: parseInt(unreadRes.rows[0].count)
        });
    }
    res.json(conversations);
});

app.get('/api/delegate/messages/:otherId', authenticate, async (req, res) => {
    const { otherId } = req.params;
    const result = await pool.query(`
        SELECT id, sender_id as "senderId", receiver_id as "receiverId", content, timestamp, read 
        FROM messages 
        WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) 
        ORDER BY timestamp ASC
    `, [req.user.id, otherId]);
    
    // Mark read
    await pool.query('UPDATE messages SET read = TRUE WHERE sender_id = $1 AND receiver_id = $2', [otherId, req.user.id]);
    
    res.json(result.rows.map(r => ({...r, timestamp: parseInt(r.timestamp)})));
});

app.post('/api/delegate/messages', authenticate, async (req, res) => {
    const { receiverId, content } = req.body;
    await pool.query(
        'INSERT INTO messages (id, sender_id, receiver_id, content, timestamp, read) VALUES ($1, $2, $3, $4, $5, $6)',
        [generateId('msg'), req.user.id, receiverId, content, Date.now(), false]
    );
    // Create notification
    const sender = (await pool.query('SELECT email FROM registrations WHERE id=$1', [req.user.id])).rows[0];
    await pool.query(
        'INSERT INTO notifications (id, user_id, type, title, message, timestamp, read) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [generateId('notif'), receiverId, 'info', 'New Message', `Message from ${sender.email}`, Date.now(), false]
    );
    res.json({ success: true });
});

app.get('/api/delegate/notifications', authenticate, async (req, res) => {
    const result = await pool.query('SELECT id, user_id as "userId", type, title, message, timestamp, read FROM notifications WHERE user_id = $1 ORDER BY timestamp DESC', [req.user.id]);
    res.json(result.rows.map(r => ({...r, timestamp: parseInt(r.timestamp)})));
});

app.put('/api/delegate/notifications/:id/read', authenticate, async (req, res) => {
    await pool.query('UPDATE notifications SET read = TRUE WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

app.delete('/api/delegate/notifications', authenticate, async (req, res) => {
    await pool.query('UPDATE notifications SET read = TRUE WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
});

// --- GAMIFICATION (Delegate) ---
app.get('/api/delegate/gamification/progress', authenticate, async (req, res) => {
    const result = await pool.query('SELECT item_id FROM scavenger_hunt_progress WHERE user_id = $1', [req.user.id]);
    res.json(result.rows.map(r => r.item_id));
});

app.post('/api/delegate/gamification/claim', authenticate, async (req, res) => {
    const { code } = req.body;
    const itemRes = await pool.query('SELECT * FROM scavenger_hunt_items WHERE secret_code = $1', [code]);
    if (itemRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Invalid code' });
    
    const item = itemRes.rows[0];
    
    try {
        await pool.query('INSERT INTO scavenger_hunt_progress (id, user_id, item_id, timestamp) VALUES ($1, $2, $3, $4)', [generateId('prog'), req.user.id, item.id, Date.now()]);
        
        // Award Coins
        const user = (await pool.query('SELECT name, email FROM registrations WHERE id=$1', [req.user.id])).rows[0];
        await pool.query(
            'INSERT INTO transactions (id, from_id, to_id, from_name, to_name, from_email, to_email, amount, type, message, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
            [generateId('tx'), 'system', req.user.id, 'Gamification', user.name, 'system', user.email, item.reward_amount, 'reward', `Found: ${item.name}`, Date.now()]
        );
        
        res.json({ success: true, message: `Found ${item.name}! +${item.reward_amount} Coins` });
    } catch (e) {
        // Unique constraint violation usually means already claimed
        res.json({ success: false, message: 'Already claimed!' });
    }
});

// --- AGENDA & CONTENT (Admin CRUD Reuse) ---
// ... existing code ...

// Sessions
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

// Speakers
app.get('/api/admin/speakers', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, name, title, company, bio, photo_url as "photoUrl", linkedin_url as "linkedinUrl", twitter_url as "twitterUrl" FROM speakers');
    res.json(r.rows);
});
app.post('/api/admin/speakers', authenticate, async (req, res) => {
    const { id, eventId, name, title, company, bio, photoUrl, linkedinUrl, twitterUrl } = req.body;
    if (id) {
        await pool.query('UPDATE speakers SET name=$1, title=$2, company=$3, bio=$4, photo_url=$5, linkedin_url=$6, twitter_url=$7 WHERE id=$8', [name, title, company, bio, photoUrl, linkedinUrl, twitterUrl, id]);
    } else {
        await pool.query('INSERT INTO speakers (id, event_id, name, title, company, bio, photo_url, linkedin_url, twitter_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [generateId('spk'), eventId, name, title, company, bio, photoUrl, linkedinUrl, twitterUrl]);
    }
    res.json({ success: true });
});
app.delete('/api/admin/speakers/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM speakers WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// Sponsors
app.get('/api/admin/sponsors', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, name, description, website_url as "websiteUrl", logo_url as "logoUrl", tier FROM sponsors');
    res.json(r.rows);
});
app.post('/api/admin/sponsors', authenticate, async (req, res) => {
    const { id, eventId, name, description, websiteUrl, logoUrl, tier } = req.body;
    if (id) {
        await pool.query('UPDATE sponsors SET name=$1, description=$2, website_url=$3, logo_url=$4, tier=$5 WHERE id=$6', [name, description, websiteUrl, logoUrl, tier, id]);
    } else {
        await pool.query('INSERT INTO sponsors (id, event_id, name, description, website_url, logo_url, tier) VALUES ($1, $2, $3, $4, $5, $6, $7)', [generateId('spo'), eventId, name, description, websiteUrl, logoUrl, tier]);
    }
    res.json({ success: true });
});
app.delete('/api/admin/sponsors/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM sponsors WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// --- OPERATIONS (Tasks) ---
app.get('/api/admin/tasks', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, title, description, status, priority, assignee_email as "assigneeEmail", due_date as "dueDate", created_at as "createdAt" FROM tasks');
    res.json(r.rows);
});
app.post('/api/admin/tasks', authenticate, async (req, res) => {
    const { id, eventId, title, description, status, priority, assigneeEmail, dueDate } = req.body;
    if (id) {
        await pool.query('UPDATE tasks SET title=$1, description=$2, status=$3, priority=$4, assignee_email=$5, due_date=$6 WHERE id=$7', [title, description, status, priority, assigneeEmail, dueDate, id]);
    } else {
        await pool.query('INSERT INTO tasks (id, event_id, title, description, status, priority, assignee_email, due_date, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [generateId('tsk'), eventId, title, description, status, priority, assigneeEmail, dueDate, Date.now()]);
    }
    res.json({ success: true });
});
app.delete('/api/admin/tasks/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// --- DINING ---
app.get('/api/admin/dining/plans', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, name, description, daily_cost as "dailyCost" FROM meal_plans');
    res.json(r.rows);
});
app.post('/api/admin/dining/plans', authenticate, async (req, res) => {
    const { id, name, description, dailyCost } = req.body;
    if (id) {
        await pool.query('UPDATE meal_plans SET name=$1, description=$2, daily_cost=$3 WHERE id=$4', [name, description, dailyCost, id]);
    } else {
        await pool.query('INSERT INTO meal_plans (id, name, description, daily_cost) VALUES ($1, $2, $3, $4)', [generateId('mp'), name, description, dailyCost]);
    }
    res.json({ success: true });
});
app.delete('/api/admin/dining/plans/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM meal_plans WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.get('/api/admin/dining/restaurants', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, name, cuisine, operating_hours as "operatingHours", menu FROM restaurants');
    res.json(r.rows);
});
app.post('/api/admin/dining/restaurants', authenticate, async (req, res) => {
    const { id, name, cuisine, operatingHours, menu } = req.body;
    if (id) {
        await pool.query('UPDATE restaurants SET name=$1, cuisine=$2, operating_hours=$3, menu=$4 WHERE id=$5', [name, cuisine, operatingHours, menu, id]);
    } else {
        await pool.query('INSERT INTO restaurants (id, name, cuisine, operating_hours, menu) VALUES ($1, $2, $3, $4, $5)', [generateId('rest'), name, cuisine, operatingHours, menu]);
    }
    res.json({ success: true });
});
app.delete('/api/admin/dining/restaurants/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM restaurants WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.get('/api/admin/dining/reservations', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, restaurant_id as "restaurantId", delegate_id as "delegateId", delegate_name as "delegateName", reservation_time as "reservationTime", party_size as "partySize" FROM dining_reservations');
    res.json(r.rows);
});
app.post('/api/admin/dining/reservations', authenticate, async (req, res) => {
    const { restaurantId, delegateId, delegateName, reservationTime, partySize } = req.body;
    await pool.query('INSERT INTO dining_reservations (id, restaurant_id, delegate_id, delegate_name, reservation_time, party_size) VALUES ($1, $2, $3, $4, $5, $6)', [generateId('res'), restaurantId, delegateId, delegateName, reservationTime, partySize]);
    res.json({ success: true });
});
app.delete('/api/admin/dining/reservations/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM dining_reservations WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// --- HOTEL ---
app.get('/api/admin/hotels', authenticate, async (req, res) => {
    const result = await pool.query('SELECT id, name, address, description, booking_url as "bookingUrl", room_types as "roomTypes" FROM hotels');
    res.json(result.rows);
});
app.post('/api/admin/hotels', authenticate, async (req, res) => {
    const { id, name, address, description, bookingUrl, roomTypes } = req.body;
    if (id) {
        await pool.query('UPDATE hotels SET name=$1, address=$2, description=$3, booking_url=$4, room_types=$5 WHERE id=$6', [name, address, description, bookingUrl, JSON.stringify(roomTypes), id]);
    } else {
        await pool.query('INSERT INTO hotels (id, name, address, description, booking_url, room_types) VALUES ($1, $2, $3, $4, $5, $6)', [generateId('htl'), name, address, description, bookingUrl, JSON.stringify(roomTypes)]);
    }
    res.json({ success: true });
});
app.delete('/api/admin/hotels/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM hotels WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});
app.get('/api/admin/hotels/:id/rooms', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, hotel_id as "hotelId", room_type_id as "roomTypeId", room_number as "roomNumber", status FROM hotel_rooms WHERE hotel_id=$1', [req.params.id]);
    res.json(r.rows);
});
app.post('/api/admin/hotels/:id/rooms/generate', authenticate, async (req, res) => {
    const { roomTypeId, count, startNumber } = req.body;
    const hotelId = req.params.id;
    for(let i=0; i<count; i++) {
        await pool.query('INSERT INTO hotel_rooms (id, hotel_id, room_type_id, room_number, status) VALUES ($1, $2, $3, $4, $5)', [generateId('rm'), hotelId, roomTypeId, String(startNumber + i), 'Available']);
    }
    res.json({ success: true });
});
app.get('/api/admin/bookings/accommodation', authenticate, async (req, res) => {
    const query = `SELECT b.id, b.delegate_id as "delegateId", b.hotel_id as "hotelId", b.room_type_id as "roomTypeId", b.check_in_date as "checkInDate", b.check_out_date as "checkOutDate", b.status, b.room_number as "roomNumber", b.hotel_room_id as "hotelRoomId", r.name as "delegateName", r.email as "delegateEmail", h.name as "hotelName", h.room_types FROM accommodation_bookings b JOIN registrations r ON b.delegate_id = r.id JOIN hotels h ON b.hotel_id = h.id`;
    const r = await pool.query(query);
    const enriched = r.rows.map(row => {
        const rt = row.room_types.find((t: any) => t.id === row.roomTypeId);
        return { ...row, roomTypeName: rt?.name || 'Unknown', room_types: undefined };
    });
    res.json(enriched);
});
app.post('/api/admin/bookings/accommodation', authenticate, async (req, res) => {
    const { delegateId, hotelId, roomTypeId, checkInDate, checkOutDate } = req.body;
    await pool.query('INSERT INTO accommodation_bookings (id, delegate_id, hotel_id, room_type_id, check_in_date, check_out_date, status, room_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [generateId('bk'), delegateId, hotelId, roomTypeId, checkInDate, checkOutDate, 'Confirmed', 'Pending']);
    res.json({ success: true });
});
app.put('/api/admin/bookings/accommodation/:id/status', authenticate, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    
    // Get booking details first to find room
    const bookingRes = await pool.query('SELECT hotel_room_id FROM accommodation_bookings WHERE id = $1', [id]);
    const booking = bookingRes.rows[0];

    await pool.query('UPDATE accommodation_bookings SET status=$1 WHERE id=$2', [status, id]);

    if (booking && booking.hotel_room_id) {
        let newRoomStatus = null;
        if (status === 'CheckedOut') newRoomStatus = 'Cleaning';
        if (status === 'Cancelled') newRoomStatus = 'Available'; // Release room
        if (status === 'CheckedIn') newRoomStatus = 'Occupied';

        if (newRoomStatus) {
            await pool.query('UPDATE hotel_rooms SET status=$1 WHERE id=$2', [newRoomStatus, booking.hotel_room_id]);
        }
    }
    res.json({ success: true });
});
app.put('/api/admin/rooms/:id/status', authenticate, async (req, res) => {
    await pool.query('UPDATE hotel_rooms SET status=$1 WHERE id=$2', [req.body.status, req.params.id]);
    res.json({ success: true });
});
app.post('/api/admin/bookings/accommodation/:id/assign', authenticate, async (req, res) => {
    const { roomId } = req.body;
    const room = (await pool.query('SELECT room_number FROM hotel_rooms WHERE id=$1', [roomId])).rows[0];
    await pool.query('UPDATE accommodation_bookings SET hotel_room_id=$1, room_number=$2, status=$3 WHERE id=$4', [roomId, room.room_number, 'CheckedIn', req.params.id]);
    await pool.query('UPDATE hotel_rooms SET status=$1 WHERE id=$2', ['Occupied', roomId]);
    res.json({ success: true });
});

// --- GAMIFICATION (Admin) ---
app.get('/api/admin/gamification/items', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, name, hint, secret_code as "secretCode", reward_amount as "rewardAmount" FROM scavenger_hunt_items');
    res.json(r.rows);
});
app.post('/api/admin/gamification/items', authenticate, async (req, res) => {
    const { id, name, hint, secretCode, rewardAmount } = req.body;
    if (id) {
        await pool.query('UPDATE scavenger_hunt_items SET name=$1, hint=$2, secret_code=$3, reward_amount=$4 WHERE id=$5', [name, hint, secretCode, rewardAmount, id]);
    } else {
        await pool.query('INSERT INTO scavenger_hunt_items (id, name, hint, secret_code, reward_amount) VALUES ($1, $2, $3, $4, $5)', [generateId('hunt'), name, hint, secretCode, rewardAmount]);
    }
    res.json({ success: true });
});
app.delete('/api/admin/gamification/items/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM scavenger_hunt_items WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});
app.get('/api/admin/gamification/leaderboard', authenticate, async (req, res) => {
    const r = await pool.query(`
        SELECT u.id as "userId", u.name, COUNT(p.id) as "itemsFound", SUM(i.reward_amount) as score
        FROM scavenger_hunt_progress p
        JOIN registrations u ON p.user_id = u.id
        JOIN scavenger_hunt_items i ON p.item_id = i.id
        GROUP BY u.id, u.name
        ORDER BY score DESC
    `);
    res.json(r.rows);
});

// --- ECONOMY (Admin) ---
app.get('/api/admin/economy/stats', authenticate, async (req, res) => {
    res.json({ totalCirculation: 10000, totalTransactions: 100, activeWallets: 50 }); // Mock calc
});
app.get('/api/admin/economy/transactions', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, from_id as "fromId", to_id as "toId", from_name as "fromName", to_name as "toName", from_email as "fromEmail", to_email as "toEmail", amount, type, message, timestamp FROM transactions ORDER BY timestamp DESC');
    res.json(r.rows);
});
app.post('/api/admin/economy/issue', authenticate, async (req, res) => {
    const { email, amount, message } = req.body;
    const user = (await pool.query('SELECT id, name FROM registrations WHERE email=$1', [email])).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    await pool.query('INSERT INTO transactions (id, from_id, to_id, from_name, to_name, from_email, to_email, amount, type, message, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [generateId('tx'), 'system', user.id, 'Admin', user.name, 'system', email, amount, 'admin_adjustment', message, Date.now()]);
    res.json({ success: true });
});

// --- TICKETING ---
app.get('/api/admin/tickets', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, name, price, currency, limit_count as "limit", sold_count as "sold", description, benefits, active FROM ticket_tiers');
    res.json(r.rows);
});
app.post('/api/admin/tickets', authenticate, async (req, res) => {
    const { id, name, price, currency, limit, sold, description, benefits, active } = req.body;
    if (id) {
        await pool.query('UPDATE ticket_tiers SET name=$1, price=$2, currency=$3, limit_count=$4, description=$5, benefits=$6, active=$7 WHERE id=$8', [name, price, currency, limit, description, benefits, active, id]);
    } else {
        await pool.query('INSERT INTO ticket_tiers (id, name, price, currency, limit_count, sold_count, description, benefits, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [generateId('tier'), name, price, currency, limit, sold, description, benefits, active]);
    }
    res.json({ success: true });
});
app.delete('/api/admin/tickets/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM ticket_tiers WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// --- MEDIA & MAPS ---
app.get('/api/admin/media', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, name, type, size, url, uploaded_at as "uploadedAt" FROM media');
    res.json(r.rows);
});
app.post('/api/admin/media', authenticate, async (req, res) => {
    const { name, type, size, url } = req.body;
    const newItem = { id: generateId('file'), name, type, size, url, uploadedAt: Date.now() };
    await pool.query('INSERT INTO media (id, name, type, size, url, uploaded_at) VALUES ($1, $2, $3, $4, $5, $6)', [newItem.id, newItem.name, newItem.type, newItem.size, newItem.url, newItem.uploadedAt]);
    res.json(newItem);
});
app.delete('/api/admin/media/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM media WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.get('/api/admin/maps', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, name, image_url as "imageUrl", pins FROM venue_maps');
    res.json(r.rows);
});
app.post('/api/admin/maps', authenticate, async (req, res) => {
    const { id, name, imageUrl, pins } = req.body;
    if (id) {
        await pool.query('UPDATE venue_maps SET name=$1, image_url=$2, pins=$3 WHERE id=$4', [name, imageUrl, JSON.stringify(pins), id]);
    } else {
        await pool.query('INSERT INTO venue_maps (id, name, image_url, pins) VALUES ($1, $2, $3, $4)', [generateId('map'), name, imageUrl, JSON.stringify(pins)]);
    }
    res.json({ success: true });
});
app.delete('/api/admin/maps/:id', authenticate, async (req, res) => {
    await pool.query('DELETE FROM venue_maps WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

// --- COMMUNICATIONS ---
app.get('/api/admin/communications/logs', authenticate, async (req, res) => {
    const r = await pool.query('SELECT id, to_email as "to", subject, body, status, error, timestamp FROM email_logs ORDER BY timestamp DESC');
    res.json(r.rows);
});
app.post('/api/admin/communications/broadcast', authenticate, async (req, res) => {
    // In real app, loop users and send emails. Here just log.
    res.json({ success: true, message: 'Broadcast queued' });
});

// --- START SERVER ---
app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
