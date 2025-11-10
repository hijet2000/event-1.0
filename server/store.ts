import { type EventConfig, type RegistrationData, type AdminUser, type Role, type Task, type Hotel, type MealPlan, type Restaurant, type Transaction, type DiningReservation, type AccommodationBooking, type MealPlanAssignment } from '../types';
import { defaultConfig } from './config';
import { hashPassword } from './auth';

interface Db {
  events: Record<string, { config: EventConfig; registrations: RegistrationData[] }>;
  adminUsers: AdminUser[];
  roles: Role[];
  tasks: Task[];
  hotels: Hotel[];
  mealPlans: MealPlan[];
  restaurants: Restaurant[];
  transactions: Transaction[];
  diningReservations: DiningReservation[];
  accommodationBookings: AccommodationBooking[];
  mealPlanAssignments: MealPlanAssignment[];
  passwordResetTokens: Map<string, { email: string; type: 'admin' | 'delegate'; eventId?: string; expires: number }>;
  inviteTokens: Map<string, { inviterName: string; inviteeEmail: string; eventId: string; expires: number }>;
}

// In-memory store
const db: Db = {
  events: {
    'main-event': {
      config: JSON.parse(JSON.stringify(defaultConfig)), // Deep copy
      registrations: [],
    }
  },
  adminUsers: [],
  roles: [],
  tasks: [],
  hotels: [],
  mealPlans: [],
  restaurants: [],
  transactions: [],
  diningReservations: [],
  accommodationBookings: [],
  mealPlanAssignments: [],
  passwordResetTokens: new Map(),
  inviteTokens: new Map(),
};

// Seed data
const seedData = async () => {
  if (db.roles.length === 0) {
    db.roles.push({
      id: 'role_super_admin',
      name: 'Super Admin',
      description: 'Has all permissions.',
      permissions: ['view_dashboard', 'manage_registrations', 'manage_settings', 'manage_users', 'manage_tasks', 'manage_dining', 'manage_accommodation'],
    });
    db.roles.push({
        id: 'role_event_manager',
        name: 'Event Manager',
        description: 'Can manage registrations and view the dashboard.',
        permissions: ['view_dashboard', 'manage_registrations'],
    });
  }

  if (db.adminUsers.length === 0) {
    const passwordHash = await hashPassword('password');
    db.adminUsers.push({
      id: 'user_admin_1',
      email: 'admin@example.com',
      passwordHash,
      roleId: 'role_super_admin',
    });
  }

  // Add some sample registrations for 'main-event'
  if (db.events['main-event'].registrations.length === 0) {
    const passwordHash = await hashPassword('password123');
    const now = Date.now();
    const sampleRegistrations: RegistrationData[] = [
        { id: 'reg_1', name: 'Alice Johnson', email: 'alice@example.com', passwordHash, createdAt: now - 86400000 * 2, company: 'Tech Corp', role: 'Developer' },
        { id: 'reg_2', name: 'Bob Williams', email: 'bob@example.com', passwordHash, createdAt: now - 86400000, company: 'Innovate LLC', role: 'Designer' },
        { id: 'reg_3', name: 'Charlie Brown', email: 'charlie@example.com', passwordHash, createdAt: now, company: 'Data Systems', role: 'Analyst' }
    ];
    db.events['main-event'].registrations.push(...sampleRegistrations);
  }
};

// Initialize with some data
seedData();

export const store = db;
