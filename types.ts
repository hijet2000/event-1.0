
// types.ts

export type Permission = 
  | 'view_dashboard'
  | 'manage_settings'
  | 'manage_registrations'
  | 'manage_users_roles'
  | 'view_eventcoin_dashboard'
  | 'manage_event_id_design';

export const ALL_PERMISSIONS: Record<Permission, string> = {
  view_dashboard: 'Can view the main admin dashboard.',
  manage_settings: 'Can change event settings, theme, and form fields.',
  manage_registrations: 'Can view, edit, and bulk import registrations.',
  manage_users_roles: 'Can create, edit, and delete admin users and roles.',
  view_eventcoin_dashboard: 'Can view the EventCoin dashboard.',
  manage_event_id_design: 'Can customize the event ID badge.',
};

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface AdminUser {
  id:string;
  email: string;
  password_hash: string;
  roleId: string;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea';
  placeholder: string;
  required: boolean;
  enabled: boolean;
}

export interface BadgeConfig {
  showName: boolean;
  showEmail: boolean;
  showCompany: boolean;
  showRole: boolean;
}

export interface EventConfig {
  event: {
    name: string;
    date: string;
    location: string;
    maxAttendees: number;
    eventType: string;
  };
  host: {
    name: string;
    email: string;
  };
  theme: {
    colorPrimary: string;
    colorSecondary: string;
    backgroundColor: string;
    fontFamily: string;
    logoUrl: string;
    pageImageUrl: string;
    websiteUrl: string;
    badgeImageUrl: string;
  };
  formFields: FormField[];
  emailTemplates: {
    userConfirmation: EmailContent;
    hostNotification: EmailContent;
    passwordReset: EmailContent;
    delegateInvitation: EmailContent;
  };
  emailProvider: 'smtp' | 'google';
  smtp: {
      host: string;
      port: number;
      username: string;
      password: string;
      encryption: 'none' | 'ssl' | 'tls';
  };
  googleConfig: {
      serviceAccountKeyJson: string;
  };
  badgeConfig: BadgeConfig;
  eventCoin: {
    enabled: boolean;
    name: string;
    startingBalance: number;
    peggedCurrency: string;
    exchangeRate: number;
  };
  githubSync: {
    enabled: boolean;
    configUrl: string;
    lastSyncTimestamp?: number;
    lastSyncStatus?: 'success' | 'failure';
    lastSyncMessage?: string;
  };
}

export interface RegistrationData {
  id: string;
  name: string;
  email: string;
  password?: string;
  password_hash?: string;
  createdAt: number;
  updatedAt: number;
  emailVerified: boolean;
  [key: string]: any; // For dynamic fields
}

export interface EmailContent {
  subject: string;
  body: string;
}

export interface EmailPayload extends EmailContent {
  to: string;
}

export interface Transaction {
  id: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toName: string;
  amount: number;
  message: string;
  type: 'initial' | 'p2p' | 'purchase';
  timestamp: number;
}

export interface Invitation {
  id: string; // The invite token
  inviterEmail: string;
  inviterName: string;
  inviteeEmail: string;
  status: 'pending' | 'accepted';
  createdAt: number;
  eventId?: string;
}

export interface EventCoinStats {
  totalCirculation: number;
  totalTransactions: number;
  activeWallets: number;
}

export interface DashboardStats {
  totalRegistrations: number;
  maxAttendees: number;
  eventDate: string;
  recentRegistrations: RegistrationData[];
  eventCoinCirculation: number;
  eventCoinName: string;
}

// Fix: Added missing PublicEvent and EventData types for multi-event functionality.
export interface PublicEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  logoUrl: string;
  colorPrimary: string;
}

export interface EventData {
  id: string;
  name: string;
  eventType: string;
}
