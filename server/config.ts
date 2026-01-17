
import { type EventConfig } from '../types';

export const defaultConfig: EventConfig = {
  event: {
    name: "Future Edge Summit 2025",
    date: "October 26-28, 2025",
    location: "Neo-Convention Hub, Silicon Valley",
    description: "The ultimate gathering for forward-thinking innovators. Future Edge Summit 2025 brings together the brightest minds in tech for three days of deep-dive workshops, networking, and industry-defining keynotes on AI, Quantum Computing, and Sustainable Tech.",
    maxAttendees: 500,
    eventType: 'Conference',
    publicUrl: "http://localhost:3000",
  },
  host: {
    name: "Future Labs Global",
    email: "summit@futurelabs.io",
  },
  theme: {
    colorPrimary: "#6366f1", // Modern Indigo
    colorSecondary: "#a855f7", // Modern Purple
    backgroundColor: "#ffffff",
    fontFamily: "Inter",
    logoUrl: "",
    pageImageUrl: "https://images.unsplash.com/photo-1540575861501-7c0011e7a48f?q=80&w=2070",
    websiteUrl: "https://example.com",
    badgeImageUrl: "",
    faviconUrl: ""
  },
  formFields: [
    {
      id: "company",
      label: "Organization",
      type: "text",
      placeholder: "e.g., SpaceX, Tesla, Acme Inc.",
      required: true,
      enabled: true,
    },
    {
      id: "job_title",
      label: "Professional Role",
      type: "text",
      placeholder: "e.g., Principal Engineer",
      required: true,
      enabled: true,
    },
    {
      id: "dietary",
      label: "Dietary Preferences",
      type: "dropdown",
      required: false,
      enabled: true,
      options: ["No Restrictions", "Vegetarian", "Vegan", "Halal", "Gluten-Free"],
    },
    {
      id: "discovery",
      label: "How did you hear about us?",
      type: "dropdown",
      required: false,
      enabled: true,
      options: ["LinkedIn", "Twitter/X", "Newsletter", "Colleague", "Other"],
    }
  ],
  emailTemplates: {
    userConfirmation: {
      subject: "Your Pass for {{eventName}} is Ready!",
      body: "Hi {{name}},\n\nYour registration for {{eventName}} has been processed. We are thrilled to have you join our community of innovators.\n\nEVENT DETAILS:\nDate: {{eventDate}}\nVenue: {{eventLocation}}\n\nYOUR ACCESS PASS:\nBelow is your digital pass. Please present this at the entry for expedited check-in.\n\n{{qrCodeUrl}}\n\nSee you on the edge!\n- The {{hostName}} Team",
    },
    hostNotification: {
      subject: "New Delegate: {{name}} registered for {{eventName}}",
      body: "New registration received.\n\nName: {{name}}\nEmail: {{email}}\n\nGoals:\n{{goals}}\n\n- Platform Internal Bot",
    },
    passwordReset: {
        subject: "Secure Link: Reset your password",
        body: "Hi,\n\nA password reset was requested for your event account.\n\n{{resetLink}}\n\n- Security Team",
    },
    delegateInvitation: {
      subject: "Special Invitation: Join us at {{eventName}}",
      body: "Hi,\n\n{{inviterName}} thought you'd be a perfect fit for {{eventName}}.\n\nSecure your spot here: {{inviteLink}}\n\nBest,\n{{hostName}}",
    }
  },
  emailProvider: 'smtp',
  smtp: {
      host: 'smtp.example.com',
      port: 587,
      username: 'user@example.com',
      password: '',
      encryption: 'tls',
  },
  googleConfig: {
      serviceAccountKeyJson: '',
      subjectEmail: '',
  },
  badgeConfig: {
    showName: true,
    showEmail: false,
    showCompany: true,
    showRole: true,
  },
  printConfig: {
    enabled: true,
    width: 4,
    height: 3,
    orientation: 'landscape',
    autoPrintOnKiosk: false
  },
  eventCoin: {
    enabled: true,
    name: "EdgeCoin",
    startingBalance: 100,
    peggedCurrency: "USD",
    exchangeRate: 1.0,
  },
  githubSync: {
    enabled: false,
    configUrl: '',
    owner: '',
    repo: '',
    path: 'config.json',
    token: ''
  },
  whatsapp: {
    enabled: false,
    accessToken: '',
    phoneNumberId: '',
  },
  telegram: {
    enabled: false,
    botToken: '',
  },
  sms: {
    enabled: false,
    provider: 'twilio',
    accountSid: '',
    authToken: '',
    fromNumber: '',
  },
  aiConcierge: {
    enabled: true,
    voice: 'Kore',
    persona: 'You are an elite event concierge for a high-tech summit. You are knowledgeable, concise, and professional.',
  }
};
