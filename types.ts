
export type Permission = 
  | 'view_dashboard' 
  | 'manage_registrations' 
  | 'manage_settings' 
  | 'manage_users'
  | 'manage_tasks'
  | 'manage_dining'
  | 'manage_accommodation'
  | 'manage_agenda'
  | 'manage_speakers_sponsors'
  | 'view_eventcoin_dashboard'
  | 'manage_eventcoin'
  | 'send_invitations'
  | 'manage_gamification'
  | 'manage_communications'
  | 'manage_media'
  | 'manage_marketing'
  | 'manage_maps'
  | 'view_system_status'
  | 'view_diagnostics';

export interface RegistrationData {
  id?: string;
  name: string;
  email: string;
  company?: string;
  role?: string;
  goals?: string; // New field for custom AI request
  ticketTierId?: string;
  createdAt: number;
  checkedIn?: boolean;
  status?: 'confirmed' | 'waitlist' | 'cancelled';
  photoUrl?: string;
  [key: string]: any;
}

export interface SocialPost {
    id: string;
    userId: string;
    userName: string;
    userPhotoUrl?: string;
    type: 'social' | 'incident';
    content: string;
    imageUrl?: string;
    timestamp: number;
    incidentCategory?: string;
    incidentSeverity?: 'low' | 'medium' | 'high';
    likes: number;
}

export interface Session {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  track?: string;
  capacity?: number;
  speakerIds: string[];
  streamUrl?: string;
}

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
    faviconUrl?: string;
  };
  formFields: FormField[];
  emailTemplates: any;
  emailProvider: 'smtp' | 'google';
  smtp: any;
  googleConfig: {
    serviceAccountKeyJson: string;
    subjectEmail: string;
  };
  badgeConfig: any;
  printConfig: any;
  eventCoin: any;
  githubSync: any;
  whatsapp: any;
  telegram: any;
  sms: any;
  aiConcierge: any;
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

export interface DashboardStats {
  totalRegistrations: number;
  maxAttendees: number;
  eventDate: string;
  registrationTrend: { date: string; count: number }[];
  taskStats: { total: number; completed: number; pending: number };
  recentRegistrations: RegistrationData[];
  eventCoinName: string;
  eventCoinCirculation: number;
  activeWallets: number;
  totalTransactions: number;
}

export interface Transaction {
  id: string;
  timestamp: number;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  fromEmail: string;
  toEmail: string;
  amount: number;
  type: 'initial' | 'p2p' | 'purchase' | 'reward' | 'admin_adjustment';
  message: string;
}

export interface AdminUser {
  id: string;
  email: string;
  roleId: string;
  permissions?: Permission[];
  createdAt: number;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface PublicEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  logoUrl?: string;
  colorPrimary?: string;
  config: EventConfig;
}

export interface Task {
  id: string;
  eventId: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assigneeEmail?: string;
  dueDate?: string;
  createdAt: number;
}

export interface MealPlan {
  id: string;
  name: string;
  description: string;
  dailyCost: number;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  operatingHours: string;
  menu?: string;
}

export interface Hotel {
  id: string;
  name: string;
  address: string;
  description: string;
  bookingUrl?: string;
  roomTypes: RoomType[];
}

export interface RoomType {
  id: string;
  name: string;
  description: string;
  capacity: number;
  totalRooms: number;
  costPerNight: number;
  amenities: string[];
}

export interface AccommodationBooking {
  id: string;
  delegateId: string;
  hotelId: string;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  status: 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled';
  hotelRoomId?: string;
  roomNumber?: string;
}

export interface EnrichedAccommodationBooking extends AccommodationBooking {
    delegateName: string;
    delegateEmail: string;
    hotelName: string;
    roomTypeName: string;
    roomNumber: string;
    hotelRoomId?: string;
}

export interface HotelRoom {
    id: string;
    hotelId: string;
    roomTypeId: string;
    roomNumber: string;
    status: 'Available' | 'Occupied' | 'Cleaning' | 'OutOfOrder';
}

export interface DiningReservation {
    id: string;
    restaurantId: string;
    delegateId: string;
    delegateName: string;
    reservationTime: string;
    partySize: number;
}

export interface AppNotification {
    id: string;
    userId: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
}

export interface SessionQuestion {
    id: string;
    sessionId: string;
    userId: string;
    userName: string;
    text: string;
    upvotes: number;
    timestamp: number;
    isAnswered: boolean;
}

export interface Poll {
    id: string;
    sessionId: string;
    question: string;
    options: string[];
    status: 'draft' | 'active' | 'closed';
    createdAt: number;
}

export interface PollWithResults extends Poll {
    votes: number[];
    totalVotes: number;
    userVotedIndex?: number;
}

export interface TicketTier {
    id: string;
    name: string;
    price: number;
    currency: string;
    limit: number;
    sold: number;
    description: string;
    benefits: string[];
    active: boolean;
}

export interface NetworkingProfile {
    userId: string;
    jobTitle: string;
    company: string;
    bio: string;
    interests: string[];
    lookingFor: string;
    linkedinUrl?: string;
    isVisible: boolean;
}

export interface NetworkingMatch {
    userId: string;
    name: string;
    jobTitle: string;
    company: string;
    score: number;
    reason: string;
    icebreaker: string;
    profile: NetworkingProfile;
    photoUrl?: string;
}

export interface ScavengerHuntItem {
    id: string;
    name: string;
    hint: string;
    secretCode: string;
    rewardAmount: number;
}

export interface LeaderboardEntry {
    userId: string;
    name: string;
    itemsFound: number;
    score: number;
}

export interface ChatMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    timestamp: number;
    read: boolean;
}

export interface ChatConversation {
    withUserId: string;
    withUserName: string;
    lastMessage: string;
    lastTimestamp: number;
    unreadCount: number;
}

export interface MediaItem {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    uploadedAt: number;
}

export interface VenueMap {
    id: string;
    name: string;
    imageUrl: string;
    pins: MapPin[];
}

export interface MapPin {
    id: string;
    x: number;
    y: number;
    label: string;
    type: 'room' | 'sponsor' | 'facility' | 'info';
    linkedId?: string;
    description?: string;
}

export const PIN_TYPES = ['room', 'sponsor', 'facility', 'info'];

/* Missing Types */
export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

export interface EmailContent {
  subject: string;
  body: string;
}

export interface EventCoinStats {
    totalCirculation: number;
    totalTransactions: number;
    activeWallets: number;
}

export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type AccommodationBookingStatus = 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled';
export type HotelRoomStatus = 'Available' | 'Occupied' | 'Cleaning' | 'OutOfOrder';

export interface MealPlanAssignment {
    id: string;
    delegateId: string;
    mealPlanId: string;
    startDate: string;
    endDate: string;
}

export type EventData = PublicEvent;

export const ALL_PERMISSIONS: Record<Permission, string> = {
    view_dashboard: 'View high-level event statistics',
    manage_registrations: 'Check-in delegates and manage attendee list',
    manage_settings: 'Edit event branding and core configuration',
    manage_users: 'Create and edit admin accounts',
    manage_tasks: 'Assign and track planning tasks',
    manage_dining: 'Configure meal plans and restaurants',
    manage_accommodation: 'Manage hotel blocks and bookings',
    manage_agenda: 'Schedule sessions and assign speakers',
    manage_speakers_sponsors: 'Edit speaker bios and sponsor tiers',
    view_eventcoin_dashboard: 'Monitor internal economy and circulation',
    manage_eventcoin: 'Issue or deduct coins from users',
    send_invitations: 'Invite new delegates via email',
    manage_gamification: 'Setup scavenger hunt challenges',
    manage_communications: 'Send broadcasts and audit email logs',
    manage_media: 'Upload and delete files in library',
    manage_marketing: 'Generate AI promotional content',
    manage_maps: 'Edit interactive floor plans',
    view_system_status: 'Check connectivity and DB schema',
    view_diagnostics: 'Run automated system tests'
};

export const PERMISSION_GROUPS: Record<string, Permission[]> = {
    'Core Access': ['view_dashboard', 'manage_settings', 'manage_users', 'view_system_status', 'view_diagnostics'],
    'Attendee Management': ['manage_registrations', 'send_invitations', 'manage_communications'],
    'Content & Logistics': ['manage_agenda', 'manage_speakers_sponsors', 'manage_media', 'manage_marketing', 'manage_maps'],
    'Hospitality': ['manage_dining', 'manage_accommodation', 'manage_tasks'],
    'Economy & Engagement': ['view_eventcoin_dashboard', 'manage_eventcoin', 'manage_gamification']
};
