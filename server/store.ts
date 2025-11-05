import { type EventConfig, type RegistrationData, type AdminUser, type Role, type Transaction, type Invitation } from '../types';
import { defaultConfig } from './config';
import { hashPassword } from './auth';

// --- In-memory store that persists across hot-reloads in dev environments ---

interface Database {
  config: EventConfig;
  registrations: Map<string, RegistrationData>;
  transactions: Map<string, Transaction>;
  invitations: Map<string, Invitation>;
  adminUsers: Map<string, AdminUser>;
  roles: Map<string, Role>;
  passwordResetTokens: Map<string, { email: string; expires: number; type: 'admin' | 'delegate' }>;
}

const globalWithDb = globalThis as typeof globalThis & { __event_platform_db?: Database };

if (!globalWithDb.__event_platform_db) {
    globalWithDb.__event_platform_db = {
        config: defaultConfig,
        registrations: new Map(),
        transactions: new Map(),
        invitations: new Map(),
        adminUsers: new Map(),
        roles: new Map(),
        passwordResetTokens: new Map(),
    };
}

export const db: Database = globalWithDb.__event_platform_db;

const seedData = async () => {
  if (db.adminUsers.size > 0) {
    return;
  }
  
  console.log("Seeding initial database...");

  // Roles
  const superAdminRole: Role = {
    id: 'role_super_admin',
    name: 'Super Admin',
    description: 'Has all permissions.',
    permissions: [
      'view_dashboard', 'manage_settings', 'manage_registrations', 
      'manage_users_roles', 'view_eventcoin_dashboard', 'manage_event_id_design'
    ]
  };
  db.roles.set(superAdminRole.id, superAdminRole);

  // Admin User
  const adminPasswordHash = await hashPassword('password123');
  const adminUser: AdminUser = {
    id: 'user_admin',
    email: 'admin@example.com',
    password_hash: adminPasswordHash,
    roleId: superAdminRole.id,
  };
  db.adminUsers.set(adminUser.email, adminUser);

  // Sample Delegate
  const delegatePasswordHash = await hashPassword('password123');
  const sampleRegistration: RegistrationData = {
      id: 'reg_12345',
      name: 'John Delegate',
      email: 'delegate@example.com',
      password_hash: delegatePasswordHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      emailVerified: true,
      company: 'Delegate Corp',
      role: 'Test User'
  };
  db.registrations.set(sampleRegistration.email, sampleRegistration);

  // Initial Transaction
  if (db.config.eventCoin.enabled) {
    const initialTransaction: Transaction = {
      id: `tx_${Date.now()}`,
      fromEmail: 'system',
      fromName: 'EventCoin Treasury',
      toEmail: sampleRegistration.email,
      toName: sampleRegistration.name,
      amount: db.config.eventCoin.startingBalance,
      message: `Initial balance deposit.`,
      type: 'initial',
      timestamp: Date.now(),
    };
    db.transactions.set(initialTransaction.id, initialTransaction);
  }
  
  console.log("Database seeded successfully.");
};

export const dbReady = seedData();
