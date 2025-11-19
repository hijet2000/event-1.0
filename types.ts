









export type Permission = 
  'view_dashboard' | 
  'manage_registrations' | 
  'manage_settings' | 
  'manage_users' |
  'manage_tasks' |
  'manage_dining' |
  'manage_accommodation' |
  'manage_agenda' |
  'manage_speakers_sponsors' |
  'view_eventcoin_dashboard'|
  'send_invitations';

export const ALL_PERMISSIONS: Record<Permission, string> = {
  view_dashboard: 'Can view the main dashboard and event statistics.',
  manage_registrations: 'Can view, edit, and manage attendee registrations.',
  send_invitations: 'Can send email invitations to potential delegates.',
  manage_settings: 'Can change event settings, theme, and registration form.',
  manage_users: 'Can create, edit, and delete admin users and roles.',
  manage_tasks: 'Can manage the event task board.',
  manage_dining: 'Can manage restaurants and meal plans.',
  manage_accommodation: 'Can manage hotels and room types.',
  manage_agenda: 'Can create, edit, and manage the event agenda.',
  manage_speakers_sponsors: 'Can manage speakers and sponsors.',
  view_eventcoin_dashboard: 'Can view the EventCoin dashboard.'
};

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface AdminUser {
    id: string;
    email: string;
    passwordHash: string;
    roleId: string;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'dropdown';
  placeholder?: string;
  required: boolean;
  enabled: boolean;
  options?: string[];
}

export interface EventConfig {
  event: {
    name: string;
    date: string;
    location: string;
    description: string;
    maxAttendees: number;
    eventType: string;
    publicUrl: string;
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
    userConfirmation: { subject: string; body: string };
    hostNotification: { subject: string; body: string };
    passwordReset: { subject: string; body: string };
    delegateInvitation: { subject: string; body: string };
  };
  emailProvider: 'smtp' | 'google';
  smtp: {
    host: string;
    port: number;
    username: string;
    password?: string;
    encryption: 'none' | 'ssl' | 'tls';
  };
  googleConfig: {
      serviceAccountKeyJson: string;
  };
  badgeConfig: {
    showName: boolean;
    showEmail: boolean;
    showCompany: boolean;
    showRole: boolean;
  };
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
  whatsapp: {
    enabled: boolean;
    accessToken: string;
    phoneNumberId: string;
  };
  sms: {
    enabled: boolean;
    provider: 'twilio';
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
}

// Base registration data, used for both form state and backend
export interface RegistrationData {
  id?: string;
  name: string;
  email: string;
  password?: string;
  passwordHash?: string;
  createdAt: number;
  verified?: boolean;
  checkedIn?: boolean;
  [key: string]: any; // For custom form fields
}

export interface EmailContent {
  subject: string;
  body: string;
}

export interface EmailPayload extends EmailContent {
  to: string;
}

export interface DashboardStats {
  totalRegistrations: number;
  maxAttendees: number;
  eventDate: string;
  eventCoinName: string;
  eventCoinCirculation: number;
  recentRegistrations: RegistrationData[];
}

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
    config: EventConfig;
}

// Delegate Portal Types
export interface DelegateProfile {
  user: RegistrationData;
  mealPlanAssignment: MealPlanAssignment | null;
  restaurants: Restaurant[];
  accommodationBooking: AccommodationBooking | null;
  hotels: Hotel[];
  sessions: Session[];
  mySessionIds: string[];
  speakers: Speaker[];
  sponsors: Sponsor[];
}

// Dining Types
export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealConsumptionLog {
  id: string;
  delegateId: string;
  mealType: MealType;
  date: string; // YYYY-MM-DD
  timestamp: number;
}
export interface MealPlan {
  id: string;
  name: string;
  description: string;
  dailyCost: number; // in EventCoin
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  operatingHours: string;
  menu: string;
}

export interface MealPlanAssignment {
  id: string;
  delegateId: string;
  mealPlanId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalCost: number;
}

export interface DiningReservation {
    id: string;
    restaurantId: string;
    delegateId: string;
    delegateName: string;
    reservationTime: string; // ISO string
    partySize: number;
}

// Accommodation Types
export type HotelRoomStatus = 'Available' | 'Occupied' | 'Cleaning' | 'OutOfOrder';
export type AccommodationBookingStatus = 'Confirmed' | 'CheckedIn' | 'CheckedOut';

export interface Hotel {
  id: string;
  name: string;
  description: string;
  address: string;
  bookingUrl?: string;
  roomTypes: RoomType[];
}

export interface HotelRoom {
  id: string;
  hotelId: string;
  roomTypeId: string;
  roomNumber: string;
  status: HotelRoomStatus;
}

export interface RoomType {
  id: string;
  name: string;
  description: string;
  amenities: string[];
  capacity: number;
  totalRooms: number;
  costPerNight: number;
}

export interface AccommodationBooking {
  id: string;
  delegateId: string;
  hotelId: string;
  roomTypeId: string;
  hotelRoomId: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  status: AccommodationBookingStatus;
  totalCost: number;
}

export interface EnrichedAccommodationBooking extends AccommodationBooking {
    delegateName: string;
    delegateEmail: string;
    hotelName: string;
    roomTypeName: string;
    roomNumber: string;
}

// EventCoin Types
export interface EventCoinStats {
  totalCirculation: number;
  totalTransactions: number;
  activeWallets: number;
}

export interface Transaction {
  id: string;
  fromId: string;
  fromName: string;
  fromEmail: string;
  toId: string;
  toName: string;
  toEmail: string;
  amount: number;
  message: string;
  type: 'initial' | 'p2p' | 'purchase' | 'reward';
  timestamp: number;
}

// Task Management Types
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface Task {
    id: string;
    eventId: string;
    title: string;
    description: string;
    status: TaskStatus;
    assigneeEmail: string;
    dueDate: string; // YYYY-MM-DD
}

// Agenda Types
export interface Session {
  id: string;
  title: string;
  description: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  location: string;
  speakerIds: string[];
}

export interface SessionFeedback {
  id: string;
  sessionId: string;
  userId: string;
  rating: number; // 1-5
  comment: string;
  timestamp: number;
}

// Speaker & Sponsor Types
export interface Speaker {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  photoUrl: string;
  linkedinUrl?: string;
  twitterUrl?: string;
}

export type SponsorshipTier = 'Platinum' | 'Gold' | 'Silver' | 'Bronze';

export const SPONSORSHIP_TIERS: SponsorshipTier[] = ['Platinum', 'Gold', 'Silver', 'Bronze'];

export interface Sponsor {
  id: string;
  name: string;
  description: string;
  websiteUrl: string;
  logoUrl: string;
  tier: SponsorshipTier;
}

// Networking Types
export interface NetworkingProfile {
    userId: string;
    bio: string;
    interests: string[]; // Array of tags
    linkedinUrl?: string;
    jobTitle: string;
    company: string;
    lookingFor: string; // e.g. "Networking", "Hiring", "Mentorship"
    isVisible: boolean;
}

export interface NetworkingMatch {
    userId: string;
    name: string;
    jobTitle: string;
    company: string;
    score: number; // 0-100
    reason: string;
    icebreaker: string;
    profile: NetworkingProfile;
}

// Gamification Types
export interface ScavengerHuntItem {
    id: string;
    name: string;
    hint: string;
    rewardAmount: number;
    secretCode: string; // The value encoded in the QR
}

export interface ScavengerHuntLog {
    id: string;
    userId: string;
    itemId: string;
    timestamp: number;
}