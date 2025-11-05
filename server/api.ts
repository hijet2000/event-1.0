
import { db, dbReady } from './store';
import { type AdminUser, type EventConfig, type DashboardStats, type EventCoinStats, type Invitation, type Permission, type RegistrationData, type Role, type Transaction, type PublicEvent, type EventData } from '../types';
import { comparePassword, generateToken, hashPassword, verifyToken } from './auth';
import { v4 as uuidv4 } from 'https://jspm.dev/uuid';
import { sendEmail } from './email';
import { generateDelegateInvitationEmail, generatePasswordResetEmail, generateRegistrationEmails } from './geminiService';

// --- HELPERS ---

const verifyAdminAccess = (token: string, requiredPermission?: Permission): { user: AdminUser, role: Role } => {
  const payload = verifyToken(token);
  if (!payload || payload.type !== 'admin') throw new Error('Authentication failed: Invalid token.');
  
  const user = db.adminUsers.get(payload.email);
  if (!user) throw new Error('Authentication failed: User not found.');
  
  const role = db.roles.get(user.roleId);
  if (!role) throw new Error('Authentication failed: Role not found.');
  
  if (requiredPermission && !role.permissions.includes(requiredPermission)) {
    throw new Error('Authorization failed: Insufficient permissions.');
  }
  return { user, role };
};

const verifyDelegateAccess = (token: string): { user: RegistrationData } => {
    const payload = verifyToken(token);
    if (!payload || payload.type !== 'delegate') throw new Error('Authentication failed: Invalid delegate token.');
    
    const user = db.registrations.get(payload.email);
    if (!user) throw new Error('Authentication failed: Delegate not found.');
    
    return { user };
};

// --- PUBLIC APIS ---

export const getPublicEventData = async (): Promise<{ config: EventConfig, registrationCount: number }> => {
    await dbReady;
    return { config: db.config, registrationCount: db.registrations.size };
};

export const getEventConfig = async (): Promise<EventConfig> => {
    await dbReady;
    return db.config;
};

// Fix: Updated signature to handle both single-event and multi-event call patterns.
export const registerUser = async (
    arg1: string | RegistrationData,
    arg2?: RegistrationData | string,
    arg3?: string
): Promise<{ success: boolean; message: string }> => {
    await dbReady;
    
    if (db.config.event.maxAttendees > 0 && db.registrations.size >= db.config.event.maxAttendees) {
        return { success: false, message: 'This event is at full capacity and no longer accepting registrations.' };
    }

    let formData: RegistrationData;
    let inviteToken: string | undefined;

    if (typeof arg1 === 'string') {
        // Multi-event call: eventId, formData, inviteToken
        formData = arg2 as RegistrationData;
        inviteToken = arg3;
    } else {
        // Single-event call: formData, inviteToken
        formData = arg1;
        inviteToken = arg2 as string | undefined;
    }

    if (db.registrations.has(formData.email)) {
        return { success: false, message: 'This email address is already registered for the event.' };
    }

    const password_hash = await hashPassword(formData.password!);
    const newRegistration: RegistrationData = {
        ...formData,
        id: `reg_${uuidv4()}`,
        password_hash,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: false,
    };
    delete newRegistration.password;
    db.registrations.set(newRegistration.email, newRegistration);
    
    if (inviteToken) {
        const invitation = db.invitations.get(inviteToken);
        if (invitation) {
            invitation.status = 'accepted';
            db.invitations.set(inviteToken, invitation);
        }
    }

    if (db.config.eventCoin.enabled && db.config.eventCoin.startingBalance > 0) {
        const initialTx: Transaction = {
            id: `tx_${uuidv4()}`,
            fromEmail: 'system',
            fromName: `${db.config.eventCoin.name} Treasury`,
            toEmail: newRegistration.email,
            toName: newRegistration.name,
            amount: db.config.eventCoin.startingBalance,
            message: 'Initial balance deposit.',
            type: 'initial',
            timestamp: Date.now(),
        };
        db.transactions.set(initialTx.id, initialTx);
    }

    return { success: true, message: 'Registration successful.' };
};

// Fix: Updated signature to handle both single-event and multi-event call patterns.
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

    const verificationLink = `https://example.com/?verify=${btoa(registrationData.email)}`;
    try {
        const { userEmail, hostEmail } = await generateRegistrationEmails(registrationData, db.config, verificationLink);
        await sendEmail({ to: registrationData.email, ...userEmail }, db.config);
        await sendEmail({ to: db.config.host.email, ...hostEmail }, db.config);
    } catch (error) {
        console.error("Failed to generate or send registration emails:", error);
    }
};

// Fix: Updated signature to handle both single-event and multi-event call patterns.
export const loginDelegate = async (
    arg1: string,
    arg2: string,
    arg3?: string
): Promise<{ token: string } | null> => {
    await dbReady;
    let email: string;
    let password_input: string;

    if (arg3 !== undefined) {
        // Multi-event call: eventId, email, password
        email = arg2;
        password_input = arg3;
    } else {
        // Single-event call: email, password
        email = arg1;
        password_input = arg2;
    }

    const user = db.registrations.get(email);
    if (!user || !user.password_hash) return null;

    const isMatch = await comparePassword(password_input, user.password_hash);
    if (isMatch) {
        const token = generateToken({ id: user.id, email: user.email, type: 'delegate' });
        return { token };
    }
    return null;
};

// Fix: Updated return type to include eventId for multi-event support.
export const getInvitationDetails = async (inviteToken: string): Promise<{ inviterName: string; inviteeEmail: string; eventId: string; } | null> => {
    await dbReady;
    const invitation = db.invitations.get(inviteToken);
    if (invitation && invitation.status === 'pending') {
        return { inviterName: invitation.inviterName, inviteeEmail: invitation.inviteeEmail, eventId: invitation.eventId || 'main-event' };
    }
    return null;
};

// --- ADMIN APIS ---

export const loginAdmin = async (email: string, password_input: string): Promise<{ token: string, user: { id: string, email: string, permissions: Permission[] } } | null> => {
    await dbReady;
    const user = db.adminUsers.get(email);
    if (!user) return null;
    
    const isMatch = await comparePassword(password_input, user.password_hash);
    if (isMatch) {
        const role = db.roles.get(user.roleId);
        if (!role) return null;
        
        const token = generateToken({ id: user.id, email: user.email, permissions: role.permissions, type: 'admin' });
        return { token, user: { id: user.id, email: user.email, permissions: role.permissions } };
    }
    return null;
};

export const getDashboardStats = async (adminToken: string): Promise<DashboardStats> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'view_dashboard');

    const allTransactions = Array.from(db.transactions.values());
    const totalCirculation = allTransactions.filter(tx => tx.type === 'initial').reduce((sum, tx) => sum + tx.amount, 0);
    const recentRegistrations = Array.from(db.registrations.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

    return {
        totalRegistrations: db.registrations.size,
        maxAttendees: db.config.event.maxAttendees,
        eventDate: db.config.event.date,
        recentRegistrations: recentRegistrations,
        eventCoinCirculation: totalCirculation,
        eventCoinName: db.config.eventCoin.name,
    };
};

export const getRegistrations = async (adminToken: string): Promise<RegistrationData[]> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'manage_registrations');
    return Array.from(db.registrations.values());
};

export const saveConfig = async (adminToken: string, config: EventConfig): Promise<EventConfig> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'manage_settings');
    db.config = config;
    return config;
};

const isPartialConfig = (obj: any): obj is Partial<EventConfig> => typeof obj === 'object' && obj !== null && typeof obj.event === 'object';

export const syncConfigFromGitHub = async (adminToken: string): Promise<EventConfig> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'manage_settings');
    const { enabled, configUrl } = db.config.githubSync;

    if (!enabled || !configUrl || !configUrl.startsWith('https://')) throw new Error("GitHub sync is not enabled or configured correctly.");

    try {
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error(`Failed to fetch from GitHub: ${response.status}`);
        const remoteConfigData: Partial<EventConfig> = await response.json();
        if (!isPartialConfig(remoteConfigData)) throw new Error("Fetched data is not a valid configuration file.");
        
        const newConfig = { ...db.config };
        const syncableKeys: (keyof EventConfig)[] = ['event', 'theme', 'formFields', 'badgeConfig', 'eventCoin', 'emailTemplates'];
        syncableKeys.forEach(key => {
            if (remoteConfigData[key]) (newConfig as any)[key] = (remoteConfigData as any)[key];
        });
        
        newConfig.githubSync = { ...db.config.githubSync, lastSyncTimestamp: Date.now(), lastSyncStatus: 'success', lastSyncMessage: `Successfully synced.` };
        db.config = newConfig;
        return newConfig;
    } catch (e) {
        db.config.githubSync = { ...db.config.githubSync, lastSyncTimestamp: Date.now(), lastSyncStatus: 'failure', lastSyncMessage: e instanceof Error ? e.message : 'Unknown error.' };
        throw e;
    }
};

export const getEventCoinStats = async (adminToken: string): Promise<EventCoinStats> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'view_eventcoin_dashboard');
    const transactions = Array.from(db.transactions.values());
    const walletEmails = new Set(transactions.flatMap(tx => [tx.fromEmail, tx.toEmail]).filter(email => email !== 'system'));

    return {
        totalCirculation: transactions.filter(t => t.type === 'initial').reduce((sum, t) => sum + t.amount, 0),
        totalTransactions: transactions.length,
        activeWallets: walletEmails.size,
    };
};

export const getAllTransactions = async (adminToken: string): Promise<Transaction[]> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'view_eventcoin_dashboard');
    return Array.from(db.transactions.values()).sort((a, b) => b.timestamp - a.timestamp);
};

export const getTransactionsForUserByAdmin = async (adminToken: string, delegateEmail: string): Promise<Transaction[]> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'manage_registrations');
    return Array.from(db.transactions.values())
        .filter(tx => tx.fromEmail === delegateEmail || tx.toEmail === delegateEmail)
        .sort((a, b) => b.timestamp - a.timestamp);
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
        if (db.registrations.has(email)) {
            result.errorCount++;
            result.errors.push(`Line ${i + 2}: Email '${email}' already exists.`);
            continue;
        }
        const newRegistration: RegistrationData = {
            id: `reg_${uuidv4()}`, name, email,
            password_hash: await hashPassword(uuidv4()),
            createdAt: Date.now(), updatedAt: Date.now(), emailVerified: true,
        };
        db.registrations.set(email, newRegistration);
        result.successCount++;
    }
    return result;
};

export const requestAdminPasswordReset = async (email: string): Promise<void> => {
    await dbReady;
    if (!db.adminUsers.has(email)) return;
    const token = uuidv4();
    db.passwordResetTokens.set(token, { email, expires: Date.now() + 3600000, type: 'admin' });
    const resetLink = `https://example.com/?resetToken=${token}`;
    try {
        const emailContent = await generatePasswordResetEmail(db.config, resetLink);
        await sendEmail({ to: email, ...emailContent }, db.config);
    } catch (e) { console.error("Failed to send admin password reset", e); throw e; }
};

export const requestDelegatePasswordReset = async (email: string): Promise<void> => {
    await dbReady;
    if (!db.registrations.has(email)) return;
    const token = uuidv4();
    db.passwordResetTokens.set(token, { email, expires: Date.now() + 3600000, type: 'delegate' });
    const resetLink = `https://example.com/?resetToken=${token}`;
    try {
        const emailContent = await generatePasswordResetEmail(db.config, resetLink);
        await sendEmail({ to: email, ...emailContent }, db.config);
    } catch (e) { console.error("Failed to send delegate password reset", e); throw e; }
};

export const resetPassword = async (token: string, newPassword_input: string): Promise<void> => {
    await dbReady;
    const req = db.passwordResetTokens.get(token);
    if (!req || req.expires < Date.now()) {
        db.passwordResetTokens.delete(token);
        throw new Error("Invalid or expired token.");
    }
    const newPasswordHash = await hashPassword(newPassword_input);
    if (req.type === 'admin') {
        const user = db.adminUsers.get(req.email);
        if (user) user.password_hash = newPasswordHash;
    } else {
        const user = db.registrations.get(req.email);
        if (user) user.password_hash = newPasswordHash;
    }
    db.passwordResetTokens.delete(token);
};

export const getAdminUsers = async (adminToken: string): Promise<AdminUser[]> => (await dbReady, verifyAdminAccess(adminToken, 'manage_users_roles'), Array.from(db.adminUsers.values()));
export const getRoles = async (adminToken: string): Promise<Role[]> => (await dbReady, verifyAdminAccess(adminToken, 'manage_users_roles'), Array.from(db.roles.values()));

export const saveAdminUser = async (adminToken: string, data: Partial<AdminUser> & { password?: string }): Promise<AdminUser> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'manage_users_roles');
    if (data.id) { // Update
        const user = Array.from(db.adminUsers.values()).find(u => u.id === data.id);
        if (!user) throw new Error("User not found.");
        const updated = { ...user, ...data };
        if (data.password) updated.password_hash = await hashPassword(data.password);
        if (data.email && data.email !== user.email) {
            db.adminUsers.delete(user.email);
        }
        db.adminUsers.set(updated.email, updated);
        return updated;
    } else { // Create
        if (!data.email || !data.password || !data.roleId) throw new Error("Email, password, role required.");
        if (db.adminUsers.has(data.email)) throw new Error("Email already exists.");
        const newUser: AdminUser = { id: `user_${uuidv4()}`, email: data.email, roleId: data.roleId, password_hash: await hashPassword(data.password) };
        db.adminUsers.set(newUser.email, newUser);
        return newUser;
    }
};

export const deleteAdminUser = async (adminToken: string, userId: string): Promise<void> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'manage_users_roles');
    const user = Array.from(db.adminUsers.values()).find(u => u.id === userId);
    if (user) {
        if (db.adminUsers.size <= 1) throw new Error("Cannot delete last admin.");
        db.adminUsers.delete(user.email);
    } else throw new Error("User not found.");
};

export const saveRole = async (adminToken: string, data: Partial<Role>): Promise<Role> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'manage_users_roles');
    if (data.id) { // Update
        const role = db.roles.get(data.id);
        if (!role) throw new Error("Role not found.");
        const updated = { ...role, ...data };
        db.roles.set(data.id, updated);
        return updated;
    } else { // Create
        if (!data.name) throw new Error("Role name required.");
        const newRole: Role = { id: `role_${uuidv4()}`, name: data.name, description: data.description || '', permissions: data.permissions || [] };
        db.roles.set(newRole.id, newRole);
        return newRole;
    }
};

export const deleteRole = async (adminToken: string, roleId: string): Promise<void> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'manage_users_roles');
    if (Array.from(db.adminUsers.values()).some(u => u.roleId === roleId)) throw new Error("Cannot delete role: in use.");
    if (!db.roles.delete(roleId)) throw new Error("Role not found.");
};

// --- DELEGATE PORTAL APIS ---

export const getDelegateProfile = async (delegateToken: string): Promise<{ user: RegistrationData, config: EventConfig }> => {
    await dbReady;
    const { user } = verifyDelegateAccess(delegateToken);
    return { user, config: db.config };
};

export const getTransactionsForUser = async (delegateToken: string): Promise<Transaction[]> => {
    await dbReady;
    const { user } = verifyDelegateAccess(delegateToken);
    return Array.from(db.transactions.values()).filter(tx => tx.fromEmail === user.email || tx.toEmail === user.email).sort((a, b) => b.timestamp - a.timestamp);
};

export const getOtherDelegates = async (delegateToken: string): Promise<{name: string, email: string}[]> => {
    await dbReady;
    const { user } = verifyDelegateAccess(delegateToken);
    return Array.from(db.registrations.values()).filter(reg => reg.email !== user.email).map(reg => ({ name: reg.name, email: reg.email }));
};

export const sendEventCoin = async (delegateToken: string, toEmail: string, amount: number, message: string): Promise<Transaction> => {
    await dbReady;
    const { user: fromUser } = verifyDelegateAccess(delegateToken);
    const toUser = db.registrations.get(toEmail);
    if (!toUser) throw new Error("Recipient not found.");
    if (fromUser.email === toUser.email) throw new Error("Cannot send to yourself.");
    if (amount <= 0) throw new Error("Amount must be positive.");

    const balance = Array.from(db.transactions.values()).filter(tx => tx.toEmail === fromUser.email || tx.fromEmail === fromUser.email).reduce((bal, tx) => bal + (tx.toEmail === fromUser.email ? tx.amount : -tx.amount), 0);
    if (balance < amount) throw new Error("Insufficient funds.");

    const newTx: Transaction = { id: `tx_${uuidv4()}`, fromEmail: fromUser.email, fromName: fromUser.name, toEmail: toUser.email, toName: toUser.name, amount, message, type: 'p2p', timestamp: Date.now() };
    db.transactions.set(newTx.id, newTx);
    return newTx;
};

// Fix: Add eventId to the created invitation.
export const createInvitation = async (delegateToken: string, inviteeEmail: string): Promise<{ invitation: Invitation, inviteLink: string }> => {
    await dbReady;
    const { user: inviter } = verifyDelegateAccess(delegateToken);
    if (!inviteeEmail || !/\S+@\S+\.\S+/.test(inviteeEmail)) throw new Error("Invalid email.");
    if (db.registrations.has(inviteeEmail)) throw new Error("Person already registered.");

    const newInvite: Invitation = { id: uuidv4(), inviterEmail: inviter.email, inviterName: inviter.name, inviteeEmail, status: 'pending', createdAt: Date.now(), eventId: 'main-event' };
    db.invitations.set(newInvite.id, newInvite);
    
    const inviteLink = `https://example.com/?inviteToken=${newInvite.id}`;
    try {
        const emailContent = await generateDelegateInvitationEmail(db.config, inviter.name, inviteLink);
        await sendEmail({ to: inviteeEmail, ...emailContent }, db.config);
    } catch (e) { console.error("Failed to send invitation email:", e); }
    
    return { invitation: newInvite, inviteLink };
};

export const getSentInvitations = async (delegateToken: string): Promise<Invitation[]> => {
    await dbReady;
    const { user } = verifyDelegateAccess(delegateToken);
    return Array.from(db.invitations.values()).filter(inv => inv.inviterEmail === user.email).sort((a, b) => b.createdAt - a.createdAt);
};

// Fix: Added missing functions for multi-event support
export const listPublicEvents = async (): Promise<PublicEvent[]> => {
    await dbReady;
    // This is a mock implementation for a single-event architecture.
    return [{
        id: 'main-event',
        name: db.config.event.name,
        date: db.config.event.date,
        location: db.config.event.location,
        logoUrl: db.config.theme.logoUrl,
        colorPrimary: db.config.theme.colorPrimary,
    }];
};

export const createEvent = async (adminToken: string, eventName: string, eventType: string): Promise<EventData> => {
    await dbReady;
    verifyAdminAccess(adminToken, 'manage_settings');
    // This is a mock implementation. In a real multi-event app, this would create a new event in the database.
    console.warn("createEvent is a mock and does not persist new events.");
    return {
        id: `evt_${uuidv4()}`,
        name: eventName,
        eventType: eventType,
    };
};
