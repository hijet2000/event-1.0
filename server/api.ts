
import { query, dbReady } from './store';
import { type AdminUser, type EventConfig, type DashboardStats, type EventCoinStats, type Invitation, type Permission, type RegistrationData, type Role, type Transaction, type PublicEvent, type EventData } from '../types';
import { comparePassword, generateToken, hashPassword, verifyToken } from './auth';
import { v4 as uuidv4 } from 'https://jspm.dev/uuid';
import { sendEmail } from './email';
import { generateDelegateInvitationEmail, generatePasswordResetEmail, generateRegistrationEmails } from './geminiService';

// --- HELPERS ---

const snakeToCamel = (str: string) => str.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('-', '').replace('_', ''));

const rowToObj = <T>(row: any): T => {
    if (!row) return null;
    const obj: any = {};
    for (const key in row) {
        obj[snakeToCamel(key)] = row[key];
    }
    return obj as T;
};

const rowToRegistration = (row: any): RegistrationData => {
  if (!row) return null;
  const { custom_fields, ...rest } = row;
  const registration: any = {
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
  };
  for (const key in rest) {
    if (key !== 'created_at' && key !== 'updated_at') {
        registration[snakeToCamel(key)] = rest[key];
    }
  }
  return { ...registration, ...(custom_fields || {}) };
};


const verifyAdminAccess = async (token: string, requiredPermission?: Permission): Promise<{ user: AdminUser, role: Role }> => {
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'admin') throw new Error('Authentication failed: Invalid token.');
  
  const { rows: userRows } = await query('SELECT * FROM admin_users WHERE email = $1', [payload.email]);
  const user = userRows[0];
  if (!user) throw new Error('Authentication failed: User not found.');
  
  const { rows: roleRows } = await query('SELECT * FROM roles WHERE id = $1', [user.role_id]);
  const role = rowToObj<Role>(roleRows[0]);
  if (!role) throw new Error('Authentication failed: Role not found.');
  
  if (requiredPermission && !role.permissions.includes(requiredPermission)) {
    throw new Error('Authorization failed: Insufficient permissions.');
  }
  return { user: rowToObj<AdminUser>(user), role };
};

const verifyDelegateAccess = async (token: string): Promise<{ user: RegistrationData }> => {
    const payload = verifyToken(token);
    if (!payload || payload.type !== 'delegate') throw new Error('Authentication failed: Invalid delegate token.');
    
    const { rows } = await query('SELECT * FROM registrations WHERE email = $1', [payload.email]);
    if (rows.length === 0) throw new Error('Authentication failed: Delegate not found.');
    
    return { user: rowToRegistration(rows[0]) };
};

// --- PUBLIC APIS ---

export const getEventConfig = async (): Promise<EventConfig> => {
    await dbReady;
    const { rows } = await query('SELECT config_data FROM event_configs WHERE id = $1', ['main-event']);
    if (rows.length === 0) throw new Error("Configuration not found.");
    return rows[0].config_data;
};

export const getPublicEventData = async (): Promise<{ config: EventConfig, registrationCount: number }> => {
    await dbReady;
    const config = await getEventConfig();
    const { rows } = await query('SELECT COUNT(*) FROM registrations');
    const registrationCount = parseInt(rows[0].count, 10);
    return { config, registrationCount };
};

export const registerUser = async (
    arg1: string | RegistrationData,
    arg2?: RegistrationData | string,
    arg3?: string
): Promise<{ success: boolean; message: string }> => {
    await dbReady;
    
    const config = await getEventConfig();
    const { rows: countRows } = await query('SELECT COUNT(*) FROM registrations');
    if (config.event.maxAttendees > 0 && parseInt(countRows[0].count, 10) >= config.event.maxAttendees) {
        return { success: false, message: 'This event is at full capacity and no longer accepting registrations.' };
    }

    let formData: RegistrationData;
    let inviteToken: string | undefined;

    if (typeof arg1 === 'string') {
        formData = arg2 as RegistrationData;
        inviteToken = arg3;
    } else {
        formData = arg1;
        inviteToken = arg2 as string | undefined;
    }
    
    const { rows: existingUser } = await query('SELECT id FROM registrations WHERE email = $1', [formData.email]);
    if (existingUser.length > 0) {
        return { success: false, message: 'This email address is already registered for the event.' };
    }

    const { name, email, password, ...customFields } = formData;
    const password_hash = await hashPassword(password!);

    await query(
        `INSERT INTO registrations (id, name, email, password_hash, created_at, updated_at, email_verified, custom_fields) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [`reg_${uuidv4()}`, name, email, password_hash, new Date(), new Date(), false, customFields]
    );
    
    if (inviteToken) {
        await query('UPDATE invitations SET status = $1 WHERE id = $2', ['accepted', inviteToken]);
    }

    if (config.eventCoin.enabled && config.eventCoin.startingBalance > 0) {
        await query(
            `INSERT INTO transactions (id, from_email, from_name, to_email, to_name, amount, message, type, timestamp) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [`tx_${uuidv4()}`, 'system', `${config.eventCoin.name} Treasury`, email, name, config.eventCoin.startingBalance, 'Initial balance deposit.', 'initial', new Date()]
        );
    }

    return { success: true, message: 'Registration successful.' };
};


export const triggerRegistrationEmails = async (
    arg1: string | RegistrationData,
    arg2?: RegistrationData
): Promise<void> => {
    await dbReady;
    let registrationData: RegistrationData;
    if (typeof arg1 === 'string') {
        registrationData = arg2 as RegistrationData;
    } else {
        registrationData = arg1;
    }
    const config = await getEventConfig();
    const verificationLink = `https://example.com/?verify=${btoa(registrationData.email)}`;
    try {
        const { userEmail, hostEmail } = await generateRegistrationEmails(registrationData, config, verificationLink);
        await sendEmail({ to: registrationData.email, ...userEmail }, config);
        await sendEmail({ to: config.host.email, ...hostEmail }, config);
    } catch (error) {
        console.error("Failed to generate or send registration emails:", error);
    }
};

export const loginDelegate = async (
    arg1: string,
    arg2: string,
    arg3?: string
): Promise<{ token: string } | null> => {
    await dbReady;
    let email: string;
    let password_input: string;

    if (arg3 !== undefined) {
        email = arg2;
        password_input = arg3;
    } else {
        email = arg1;
        password_input = arg2;
    }

    const { rows } = await query('SELECT * FROM registrations WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !user.password_hash) return null;

    const isMatch = await comparePassword(password_input, user.password_hash);
    if (isMatch) {
        const token = generateToken({ id: user.id, email: user.email, type: 'delegate' });
        return { token };
    }
    return null;
};

export const getInvitationDetails = async (inviteToken: string): Promise<{ inviterName: string; inviteeEmail: string; eventId: string; } | null> => {
    await dbReady;
    const { rows } = await query('SELECT * FROM invitations WHERE id = $1', [inviteToken]);
    const invitation = rowToObj<Invitation>(rows[0]);
    if (invitation && invitation.status === 'pending') {
        return { inviterName: invitation.inviterName, inviteeEmail: invitation.inviteeEmail, eventId: invitation.eventId || 'main-event' };
    }
    return null;
};

// --- ADMIN APIS ---

export const loginAdmin = async (email: string, password_input: string): Promise<{ token: string, user: { id: string, email: string, permissions: Permission[] } } | null> => {
    await dbReady;
    const { rows: userRows } = await query('SELECT * FROM admin_users WHERE email = $1', [email]);
    const user = userRows[0];
    if (!user) return null;
    
    const isMatch = await comparePassword(password_input, user.password_hash);
    if (isMatch) {
        const { rows: roleRows } = await query('SELECT * FROM roles WHERE id = $1', [user.role_id]);
        const role = rowToObj<Role>(roleRows[0]);
        if (!role) return null;
        
        const token = generateToken({ id: user.id, email: user.email, permissions: role.permissions, type: 'admin' });
        return { token, user: { id: user.id, email: user.email, permissions: role.permissions } };
    }
    return null;
};

export const getDashboardStats = async (adminToken: string): Promise<DashboardStats> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'view_dashboard');
    
    const config = await getEventConfig();
    const { rows: regCountRows } = await query('SELECT COUNT(*) FROM registrations');
    const { rows: circulationRows } = await query("SELECT SUM(amount) as total FROM transactions WHERE type = 'initial'");
    const { rows: recentRegRows } = await query('SELECT * FROM registrations ORDER BY created_at DESC LIMIT 5');

    return {
        totalRegistrations: parseInt(regCountRows[0].count, 10),
        maxAttendees: config.event.maxAttendees,
        eventDate: config.event.date,
        recentRegistrations: recentRegRows.map(rowToRegistration),
        eventCoinCirculation: parseFloat(circulationRows[0]?.total || '0'),
        eventCoinName: config.eventCoin.name,
    };
};

export const getRegistrations = async (adminToken: string): Promise<RegistrationData[]> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'manage_registrations');
    const { rows } = await query('SELECT * FROM registrations ORDER BY created_at DESC');
    return rows.map(rowToRegistration);
};

export const saveConfig = async (adminToken: string, config: EventConfig): Promise<EventConfig> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'manage_settings');
    await query('UPDATE event_configs SET config_data = $1 WHERE id = $2', [config, 'main-event']);
    return config;
};

export const syncConfigFromGitHub = async (adminToken: string): Promise<EventConfig> => {
    await dbReady;
    const { user } = await verifyAdminAccess(adminToken, 'manage_settings');
    const currentConfig = await getEventConfig();
    const { enabled, configUrl } = currentConfig.githubSync;

    if (!enabled || !configUrl || !configUrl.startsWith('https://')) throw new Error("GitHub sync is not enabled or configured correctly.");

    let newConfig = { ...currentConfig };
    try {
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error(`Failed to fetch from GitHub: ${response.status}`);
        const remoteConfigData: Partial<EventConfig> = await response.json();
        
        const syncableKeys: (keyof EventConfig)[] = ['event', 'theme', 'formFields', 'badgeConfig', 'eventCoin', 'emailTemplates'];
        syncableKeys.forEach(key => {
            if (remoteConfigData[key]) (newConfig as any)[key] = (remoteConfigData as any)[key];
        });
        
        newConfig.githubSync = { ...currentConfig.githubSync, lastSyncTimestamp: Date.now(), lastSyncStatus: 'success', lastSyncMessage: `Successfully synced.` };
        await saveConfig(adminToken, newConfig);
        return newConfig;
    } catch (e) {
        newConfig.githubSync = { ...currentConfig.githubSync, lastSyncTimestamp: Date.now(), lastSyncStatus: 'failure', lastSyncMessage: e instanceof Error ? e.message : 'Unknown error.' };
        await saveConfig(adminToken, newConfig);
        throw e;
    }
};

export const getEventCoinStats = async (adminToken: string): Promise<EventCoinStats> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'view_eventcoin_dashboard');

    const { rows: circulationRows } = await query("SELECT SUM(amount) as total FROM transactions WHERE type = 'initial'");
    const { rows: txCountRows } = await query('SELECT COUNT(*) FROM transactions');
    const { rows: walletRows } = await query("SELECT COUNT(DISTINCT email) FROM (SELECT from_email as email FROM transactions WHERE from_email != 'system' UNION SELECT to_email as email FROM transactions) as wallets");
    
    return {
        totalCirculation: parseFloat(circulationRows[0]?.total || '0'),
        totalTransactions: parseInt(txCountRows[0].count, 10),
        activeWallets: parseInt(walletRows[0].count, 10),
    };
};

export const getAllTransactions = async (adminToken: string): Promise<Transaction[]> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'view_eventcoin_dashboard');
    const { rows } = await query('SELECT * FROM transactions ORDER BY timestamp DESC');
    return rows.map(row => rowToObj<Transaction>(row));
};

export const getTransactionsForUserByAdmin = async (adminToken: string, delegateEmail: string): Promise<Transaction[]> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'manage_registrations');
    const { rows } = await query('SELECT * FROM transactions WHERE from_email = $1 OR to_email = $1 ORDER BY timestamp DESC', [delegateEmail]);
    return rows.map(row => rowToObj<Transaction>(row));
};

export const addFundsToDelegateByAdmin = async (adminToken: string, delegateEmail: string, amount: number, message: string): Promise<Transaction> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'manage_registrations');
    
    const { rows: delegateRows } = await query('SELECT name FROM registrations WHERE email = $1', [delegateEmail]);
    if (delegateRows.length === 0) throw new Error("Delegate not found.");
    const delegate = delegateRows[0];
    if (amount <= 0) throw new Error("Amount must be a positive number.");

    const newTx: Transaction = {
        id: `tx_${uuidv4()}`,
        fromEmail: 'system_admin',
        fromName: 'Admin Credit',
        toEmail: delegateEmail,
        toName: delegate.name,
        amount,
        message: message || 'Administrative credit.',
        type: 'purchase',
        timestamp: Date.now(),
    };
    await query(
        `INSERT INTO transactions (id, from_email, from_name, to_email, to_name, amount, message, type, timestamp) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newTx.id, newTx.fromEmail, newTx.fromName, newTx.toEmail, newTx.toName, newTx.amount, newTx.message, newTx.type, new Date(newTx.timestamp)]
    );
    return newTx;
};


export const bulkImportRegistrations = async (adminToken: string, csvData: string): Promise<{ successCount: number; errorCount: number; errors: string[] }> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'manage_registrations');
    const result = { successCount: 0, errorCount: 0, errors: [] as string[] };
    const lines = csvData.trim().split('\n');
    lines.shift(); // Skip header

    for (const [i, line] of lines.entries()) {
        const [name, email] = line.split(',').map(s => s.trim());
        if (!name || !email || !/\S+@\S+\.\S+/.test(email)) {
            result.errorCount++;
            result.errors.push(`Line ${i + 2}: Invalid data.`);
            continue;
        }
        const { rows } = await query('SELECT id FROM registrations WHERE email = $1', [email]);
        if (rows.length > 0) {
            result.errorCount++;
            result.errors.push(`Line ${i + 2}: Email '${email}' already exists.`);
            continue;
        }
        
        await query(
            'INSERT INTO registrations (id, name, email, password_hash, created_at, updated_at, email_verified) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [`reg_${uuidv4()}`, name, email, await hashPassword(uuidv4()), new Date(), new Date(), true]
        );
        result.successCount++;
    }
    return result;
};


export const requestAdminPasswordReset = async (email: string): Promise<void> => {
    await dbReady;
    const { rows } = await query('SELECT id FROM admin_users WHERE email = $1', [email]);
    if (rows.length === 0) return;
    
    const token = uuidv4();
    const expires = new Date(Date.now() + 3600000);
    await query('INSERT INTO password_reset_tokens (token, email, expires, type) VALUES ($1, $2, $3, $4)', [token, email, expires, 'admin']);
    
    const config = await getEventConfig();
    const resetLink = `https://example.com/?resetToken=${token}`;
    try {
        const emailContent = await generatePasswordResetEmail(config, resetLink);
        await sendEmail({ to: email, ...emailContent }, config);
    } catch (e) { console.error("Failed to send admin password reset", e); throw e; }
};

export const requestDelegatePasswordReset = async (email: string): Promise<void> => {
    await dbReady;
    const { rows } = await query('SELECT id FROM registrations WHERE email = $1', [email]);
    if (rows.length === 0) return;
    
    const token = uuidv4();
    const expires = new Date(Date.now() + 3600000);
    await query('INSERT INTO password_reset_tokens (token, email, expires, type) VALUES ($1, $2, $3, $4)', [token, email, expires, 'delegate']);

    const config = await getEventConfig();
    const resetLink = `https://example.com/?resetToken=${token}`;
    try {
        const emailContent = await generatePasswordResetEmail(config, resetLink);
        await sendEmail({ to: email, ...emailContent }, config);
    } catch (e) { console.error("Failed to send delegate password reset", e); throw e; }
};

export const resetPassword = async (token: string, newPassword_input: string): Promise<void> => {
    await dbReady;
    const { rows } = await query('SELECT * FROM password_reset_tokens WHERE token = $1', [token]);
    const req = rows[0];
    if (!req || new Date(req.expires) < new Date()) {
        if (req) await query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
        throw new Error("Invalid or expired token.");
    }
    
    const newPasswordHash = await hashPassword(newPassword_input);
    const table = req.type === 'admin' ? 'admin_users' : 'registrations';
    await query(`UPDATE ${table} SET password_hash = $1 WHERE email = $2`, [newPasswordHash, req.email]);
    await query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
};


export const getAdminUsers = async (adminToken: string): Promise<AdminUser[]> => (await dbReady, await verifyAdminAccess(adminToken, 'manage_users_roles'), (await query('SELECT id, email, role_id FROM admin_users')).rows.map(r => rowToObj<AdminUser>(r)));
export const getRoles = async (adminToken: string): Promise<Role[]> => (await dbReady, await verifyAdminAccess(adminToken, 'manage_users_roles'), (await query('SELECT * FROM roles')).rows.map(r => rowToObj<Role>(r)));

export const saveAdminUser = async (adminToken: string, data: Partial<AdminUser> & { password?: string }): Promise<AdminUser> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'manage_users_roles');
    if (data.id) { // Update
        const password_hash = data.password ? await hashPassword(data.password) : null;
        if (password_hash) {
            await query('UPDATE admin_users SET email = $1, role_id = $2, password_hash = $3 WHERE id = $4', [data.email, data.roleId, password_hash, data.id]);
        } else {
            await query('UPDATE admin_users SET email = $1, role_id = $2 WHERE id = $3', [data.email, data.roleId, data.id]);
        }
        const {rows} = await query('SELECT * FROM admin_users WHERE id = $1', [data.id]);
        return rowToObj<AdminUser>(rows[0]);
    } else { // Create
        if (!data.email || !data.password || !data.roleId) throw new Error("Email, password, role required.");
        const {rows: existing} = await query('SELECT id FROM admin_users WHERE email = $1', [data.email]);
        if (existing.length > 0) throw new Error("Email already exists.");
        
        const newUser: AdminUser = { id: `user_${uuidv4()}`, email: data.email, roleId: data.roleId, password_hash: await hashPassword(data.password) };
        await query('INSERT INTO admin_users (id, email, password_hash, role_id) VALUES ($1, $2, $3, $4)', [newUser.id, newUser.email, newUser.password_hash, newUser.roleId]);
        return newUser;
    }
};

export const deleteAdminUser = async (adminToken: string, userId: string): Promise<void> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'manage_users_roles');
    const { rows } = await query('SELECT COUNT(*) FROM admin_users');
    if (parseInt(rows[0].count, 10) <= 1) throw new Error("Cannot delete last admin.");
    await query('DELETE FROM admin_users WHERE id = $1', [userId]);
};

export const saveRole = async (adminToken: string, data: Partial<Role>): Promise<Role> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'manage_users_roles');
    if (data.id) { // Update
        await query('UPDATE roles SET name = $1, description = $2, permissions = $3 WHERE id = $4', [data.name, data.description, data.permissions, data.id]);
        const { rows } = await query('SELECT * FROM roles WHERE id = $1', [data.id]);
        return rowToObj<Role>(rows[0]);
    } else { // Create
        if (!data.name) throw new Error("Role name required.");
        const newRole: Role = { id: `role_${uuidv4()}`, name: data.name, description: data.description || '', permissions: data.permissions || [] };
        await query('INSERT INTO roles (id, name, description, permissions) VALUES ($1, $2, $3, $4)', [newRole.id, newRole.name, newRole.description, newRole.permissions]);
        return newRole;
    }
};

export const deleteRole = async (adminToken: string, roleId: string): Promise<void> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'manage_users_roles');
    const { rows } = await query('SELECT id FROM admin_users WHERE role_id = $1', [roleId]);
    if (rows.length > 0) throw new Error("Cannot delete role: in use.");
    await query('DELETE FROM roles WHERE id = $1', [roleId]);
};

// --- DELEGATE PORTAL APIS ---

export const getDelegateProfile = async (delegateToken: string): Promise<{ user: RegistrationData, config: EventConfig }> => {
    await dbReady;
    const { user } = await verifyDelegateAccess(delegateToken);
    const config = await getEventConfig();
    return { user, config };
};

export const updateDelegateProfile = async (delegateToken: string, profileData: { name: string, [key: string]: any }): Promise<RegistrationData> => {
    await dbReady;
    const { user } = await verifyDelegateAccess(delegateToken);
    const { name, company, role } = profileData;

    const { rows: oldUserRows } = await query('SELECT custom_fields FROM registrations WHERE email = $1', [user.email]);
    const oldCustomFields = oldUserRows[0].custom_fields || {};
    const newCustomFields = { ...oldCustomFields, company, role };

    await query('UPDATE registrations SET name = $1, custom_fields = $2, updated_at = $3 WHERE email = $4', [name, newCustomFields, new Date(), user.email]);
    
    const { rows } = await query('SELECT * FROM registrations WHERE email = $1', [user.email]);
    return rowToRegistration(rows[0]);
};

export const getTransactionsForUser = async (delegateToken: string): Promise<Transaction[]> => {
    await dbReady;
    const { user } = await verifyDelegateAccess(delegateToken);
    const { rows } = await query('SELECT * FROM transactions WHERE from_email = $1 OR to_email = $1 ORDER BY timestamp DESC', [user.email]);
    return rows.map(r => rowToObj<Transaction>(r));
};

export const getOtherDelegates = async (delegateToken: string): Promise<{name: string, email: string}[]> => {
    await dbReady;
    const { user } = await verifyDelegateAccess(delegateToken);
    const { rows } = await query('SELECT name, email FROM registrations WHERE email != $1', [user.email]);
    return rows;
};

export const sendEventCoin = async (delegateToken: string, toEmail: string, amount: number, message: string): Promise<Transaction> => {
    await dbReady;
    const { user: fromUser } = await verifyDelegateAccess(delegateToken);
    const { rows: toUserRows } = await query('SELECT name FROM registrations WHERE email = $1', [toEmail]);
    if (toUserRows.length === 0) throw new Error("Recipient not found.");
    const toUser = toUserRows[0];
    if (fromUser.email === toEmail) throw new Error("Cannot send to yourself.");
    if (amount <= 0) throw new Error("Amount must be positive.");

    const { rows } = await query('SELECT * FROM transactions WHERE from_email = $1 OR to_email = $1', [fromUser.email]);
    const balance = rows.reduce((bal, tx) => bal + (tx.to_email === fromUser.email ? tx.amount : -tx.amount), 0);
    if (balance < amount) throw new Error("Insufficient funds.");

    const newTx: Transaction = { id: `tx_${uuidv4()}`, fromEmail: fromUser.email, fromName: fromUser.name, toEmail: toEmail, toName: toUser.name, amount, message, type: 'p2p', timestamp: Date.now() };
    await query(
        `INSERT INTO transactions (id, from_email, from_name, to_email, to_name, amount, message, type, timestamp) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newTx.id, newTx.fromEmail, newTx.fromName, newTx.toEmail, newTx.toName, newTx.amount, newTx.message, newTx.type, new Date(newTx.timestamp)]
    );
    return newTx;
};

export const createInvitation = async (delegateToken: string, inviteeEmail: string): Promise<{ invitation: Invitation, inviteLink: string }> => {
    await dbReady;
    const { user: inviter } = await verifyDelegateAccess(delegateToken);
    if (!inviteeEmail || !/\S+@\S+\.\S+/.test(inviteeEmail)) throw new Error("Invalid email.");
    
    const { rows } = await query('SELECT id FROM registrations WHERE email = $1', [inviteeEmail]);
    if (rows.length > 0) throw new Error("Person already registered.");

    const newInvite: Invitation = { id: uuidv4(), inviterEmail: inviter.email, inviterName: inviter.name, inviteeEmail, status: 'pending', createdAt: Date.now(), eventId: 'main-event' };
    await query('INSERT INTO invitations (id, inviter_email, inviter_name, invitee_email, status, created_at, event_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [newInvite.id, newInvite.inviterEmail, newInvite.inviterName, newInvite.inviteeEmail, newInvite.status, new Date(newInvite.createdAt), newInvite.eventId]
    );
    
    const config = await getEventConfig();
    const inviteLink = `https://example.com/?inviteToken=${newInvite.id}`;
    try {
        const emailContent = await generateDelegateInvitationEmail(config, inviter.name, inviteLink);
        await sendEmail({ to: inviteeEmail, ...emailContent }, config);
    } catch (e) { console.error("Failed to send invitation email:", e); }
    
    return { invitation: newInvite, inviteLink };
};

export const getSentInvitations = async (delegateToken: string): Promise<Invitation[]> => {
    await dbReady;
    const { user } = await verifyDelegateAccess(delegateToken);
    const { rows } = await query('SELECT * FROM invitations WHERE inviter_email = $1 ORDER BY created_at DESC', [user.email]);
    return rows.map(r => rowToObj<Invitation>(r));
};

export const listPublicEvents = async (): Promise<PublicEvent[]> => {
    await dbReady;
    const config = await getEventConfig();
    // This is a mock implementation for a single-event architecture.
    return [{
        id: 'main-event',
        name: config.event.name,
        date: config.event.date,
        location: config.event.location,
        logoUrl: config.theme.logoUrl,
        colorPrimary: config.theme.colorPrimary,
    }];
};

export const createEvent = async (adminToken: string, eventName: string, eventType: string): Promise<EventData> => {
    await dbReady;
    await verifyAdminAccess(adminToken, 'manage_settings');
    // This is a mock implementation. In a real multi-event app, this would create a new event in the database.
    console.warn("createEvent is a mock and does not persist new events.");
    return {
        id: `evt_${uuidv4()}`,
        name: eventName,
        eventType: eventType,
    };
};
