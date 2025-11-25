
// Mock Express setup for type checking
const app = { get: (path:any, ...handlers:any[]) => {}, post: (path:any, ...handlers:any[]) => {}, put: (path:any, ...handlers:any[]) => {}, delete: (path:any, ...handlers:any[]) => {} };
const authenticate = (req:any, res:any, next:any) => next();
const query = async (sql:string, params?:any[]) => ({ rows: [] as any[] });
const generateId = (prefix: string) => prefix + Date.now();

// ... existing imports ...

// === MESSAGING ROUTES ===
app.get('/api/conversations', authenticate, async (req: any, res: any) => {
    const userId = req.user.id;
    
    // Complex query to get latest message per conversation
    // This is a simplified version. In production, use DISTINCT ON or Window Functions.
    const text = `
        SELECT 
            CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as other_id,
            MAX(timestamp) as last_timestamp
        FROM messages
        WHERE sender_id = $1 OR receiver_id = $1
        GROUP BY other_id
        ORDER BY last_timestamp DESC
    `;
    
    const convos = await query(text, [userId]);
    
    const results = [];
    for (const row of convos.rows) {
        const otherUser = await query('SELECT name FROM registrations WHERE id = $1', [row.other_id]);
        const lastMsg = await query('SELECT content, read FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY timestamp DESC LIMIT 1', [userId, row.other_id]);
        const unreadCount = await query('SELECT COUNT(*) FROM messages WHERE sender_id = $1 AND receiver_id = $2 AND read = FALSE', [row.other_id, userId]);
        
        if (otherUser.rows.length > 0) {
            results.push({
                withUserId: row.other_id,
                withUserName: otherUser.rows[0].name,
                lastMessage: lastMsg.rows[0].content,
                lastTimestamp: parseInt(row.last_timestamp),
                unreadCount: parseInt(unreadCount.rows[0].count)
            });
        }
    }
    
    res.json(results);
});

app.get('/api/messages/:otherId', authenticate, async (req: any, res: any) => {
    const { otherId } = req.params;
    const userId = req.user.id;
    
    const result = await query(
        'SELECT * FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY timestamp ASC',
        [userId, otherId]
    );
    
    // Mark as read
    await query('UPDATE messages SET read = TRUE WHERE sender_id = $1 AND receiver_id = $2', [otherId, userId]);
    
    res.json(result.rows.map(r => ({
        id: r.id,
        senderId: r.sender_id,
        receiverId: r.receiver_id,
        content: r.content,
        timestamp: parseInt(r.timestamp),
        read: r.read
    })));
});

app.post('/api/messages', authenticate, async (req: any, res: any) => {
    const { receiverId, content } = req.body;
    const senderId = req.user.id;
    const id = generateId('msg');
    
    await query(
        'INSERT INTO messages (id, sender_id, receiver_id, content, timestamp, read) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, senderId, receiverId, content, Date.now(), false]
    );
    
    res.json({ success: true });
});

// ... rest of existing code ...
