
import { type EventConfig } from '../types';

export const defaultConfig: EventConfig = {
  event: {
    name: "InnovateSphere 2024 Tech Summit",
    date: "October 26-28, 2024",
    location: "Virtual",
    maxAttendees: 250,
    eventType: 'Conference',
  },
  host: {
    name: "Tech Events Inc.",
    email: "host@example.com",
  },
  theme: {
    colorPrimary: "#4f46e5", // Indigo 600
    colorSecondary: "#ec4899", // Pink 500
    backgroundColor: "#f9fafb", // Gray 50
    fontFamily: "Inter",
    logoUrl: "",
    pageImageUrl: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=2000",
    websiteUrl: "https://example.com",
    badgeImageUrl: "https://images.unsplash.com/photo-1620932934088-fb1023940157?q=80&w=1887"
  },
  formFields: [
    {
      id: "company",
      label: "Company Name",
      type: "text",
      placeholder: "e.g. Acme Corporation",
      required: false,
      enabled: true,
    },
    {
      id: "role",
      label: "Your Role",
      type: "text",
      placeholder: "e.g. Software Engineer",
      required: true,
      enabled: true,
    },
  ],
  emailTemplates: {
    userConfirmation: {
      subject: "Registration Confirmed for {{eventName}}!",
      body: "Hi {{name}},\n\nThank you for registering for {{eventName}}! We're thrilled to have you join us on {{eventDate}} at {{eventLocation}}.\n\nPlease verify your email address by clicking the link below:\n{{verificationLink}}\n\nSee you there!\n- The {{hostName}} Team",
    },
    hostNotification: {
      subject: "New Registration for {{eventName}}: {{name}}",
      body: "A new user has registered for {{eventName}}.\n\nName: {{name}}\nEmail: {{email}}\n\nAdditional Information:\n{{customFields}}\n\n- Event Registration System",
    },
    passwordReset: {
        subject: "Password Reset Request for {{eventName}}",
        body: "Hi,\n\nYou requested a password reset for your account for {{eventName}}.\n\nClick the link below to reset your password. This link is valid for one hour.\n{{resetLink}}\n\nIf you did not request this, please ignore this email.\n\n- The {{hostName}} Team",
    },
    delegateInvitation: {
      subject: "You're invited to {{eventName}}!",
      body: "Hi there,\n\n{{inviterName}} has invited you to join them at {{eventName}}.\n\nClick the link below to register for the event:\n{{inviteLink}}\n\nWe look forward to seeing you!\n- The {{hostName}} Team",
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
  },
  badgeConfig: {
    showName: true,
    showEmail: false,
    showCompany: true,
    showRole: true,
  },
  eventCoin: {
    enabled: true,
    name: "EventCoin",
    startingBalance: 100,
    peggedCurrency: "USD",
    exchangeRate: 1.0,
  },
  githubSync: {
    enabled: false,
    configUrl: '',
  }
};
