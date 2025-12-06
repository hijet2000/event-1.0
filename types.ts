
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
  | 'send_invitations';

export const ALL_PERMISSIONS: Record<Permission, string> = {
  view_dashboard: 'View Dashboard',
  manage_registrations: 'Manage Registrations',
  manage_settings: 'Manage Settings',
  manage_users: 'Manage Users',
  manage_tasks: 'Manage Tasks',
  manage_dining: 'Manage Dining',
  manage_accommodation: 'Manage Accommodation',
  manage_agenda: 'Manage Agenda',
  manage_speakers_sponsors: 'Manage Speakers & Sponsors',
  view_eventcoin_dashboard: 'View EventCoin Dashboard',
  send_invitations: 'Send Invitations'
};

export interface RegistrationData {
  id?: string;
  name: string;
  email: string;
  company?: string;
  role?: string;
  ticketTierId?: string;
  createdAt: number;
  checkedIn?: boolean;
  status?: 'confirmed' | 'waitlist' | 'cancelled';
  [key: string]: any;
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

export interface AiConciergeConfig {
    enabled: boolean;
    voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
    persona: string;
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
    lastSyncStatus?: 'success' | 'failed';
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
  aiConcierge: AiConciergeConfig;
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

export interface EmailContent {
  subject: string;
  body: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
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

export interface EventCoinStats {
  totalCirculation: number;
  totalTransactions: number;
  activeWallets: number;
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

export interface EventData {
    id: string;
    name: string;
    type: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  eventId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
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

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlanAssignment {
  id: string;
  delegateId: string;
  mealPlanId: string;
  startDate: string;
  endDate: string;
}

export interface AccommodationBooking {
  id: string;
  delegateId: string;
  hotelId: string;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  status: AccommodationBookingStatus;
  hotelRoomId?: string; // ID of the specific room assigned
  roomNumber?: string; // Cached room number for display
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

export type AccommodationBookingStatus = 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled';

export interface EnrichedAccommodationBooking extends AccommodationBooking {
    delegateName: string;
    delegateEmail: string;
    hotelName: string;
    roomTypeName: string;
    roomNumber: string;
    hotelRoomId?: string;
}

export type HotelRoomStatus = 'Available' | 'Occupied' | 'Cleaning' | 'OutOfOrder';

export interface HotelRoom {
    id: string;
    hotelId: string;
    roomTypeId: string;
    roomNumber: string;
    status: HotelRoomStatus;
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

export interface PollVote {
    id: string;
    pollId: string;
    userId: string;
    optionIndex: number;
    timestamp: number;
}

export interface PollWithResults extends Poll {
    votes: number[]; // Array of vote counts per option index
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
    x: number; // Percentage 0-100
    y: number; // Percentage 0-100
    label: string;
    type: 'room' | 'sponsor' | 'facility' | 'info';
    linkedId?: string; // ID of session/room or sponsor
    description?: string;
}

export const PIN_TYPES = ['room', 'sponsor', 'facility', 'info'];
