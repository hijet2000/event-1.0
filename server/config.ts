



import { type EventConfig } from '../types';

export const defaultConfig: EventConfig = {
  event: {
    name: "Tech Summit 2025",
    date: "October 26-28, 2025",
    location: "Metropolis Convention Center",
    description: "Join us for the premier technology event of the year. Tech Summit 2025 brings together industry leaders, innovators, and developers for three days of inspiration, learning, and networking. Explore the latest trends in AI, Cloud Computing, and Web Development.",
    maxAttendees: 500,
    eventType: 'Conference',
    publicUrl: "http://localhost:3000",
  },
  host: {
    name: "Event Organizers Inc.",
    email: "contact@techsummit.com",
  },
  theme: {
    colorPrimary: "#4f46e5", // Indigo 600
    colorSecondary: "#ec4899", // Pink 500
    backgroundColor: "#f9fafb", // Gray 50
    fontFamily: "Inter",
    logoUrl: "",
    pageImageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=2070",
    websiteUrl: "https://example.com",
    badgeImageUrl: "https://images.unsplash.com/photo-1620932934088-fb1023940157?q=80&w=1887"
  },
  formFields: [
    {
      id: "company",
      label: "Company / Organization",
      type: "text",
      placeholder: "e.g., Acme Corporation",
      required: false,
      enabled: true,
    },
    {
      id: "job_title",
      label: "Job Title",
      type: "text",
      placeholder: "e.g., Software Engineer",
      required: false,
      enabled: true,
    },
    {
      id: "dietary_restrictions",
      label: "Dietary Restrictions",
      type: "dropdown",
      placeholder: "Select an option...",
      required: false,
      enabled: true,
      options: ["None", "Vegetarian", "Vegan", "Gluten-Free", "Other"],
    },
    {
      id: "comments",
      label: "Additional Comments",
      type: "textarea",
      placeholder: "Any other information you'd like to share?",
      required: false,
      enabled: false,
    },
  ],
  emailTemplates: {
    userConfirmation: {
      subject: "Registration Confirmed for {{eventName}}!",
      body: "Hi {{name}},\n\nThank you for registering for the {{eventName}}. We're excited to have you join us on {{eventDate}} at {{eventLocation}}.\n\n-- YOUR EVENT PASS --\n\nPlease keep this QR code handy. You will need it for fast check-in and to access services like dining and accommodation.\n\nHere is your QR code: {{qrCodeUrl}}\n\nYou can log in to the delegate portal at any time to manage your details and access your pass.\n\nSee you there!\n- The {{hostName}} Team",
    },
    hostNotification: {
      subject: "New Registration for {{eventName}}: {{name}}",
      body: "A new delegate has registered for the {{eventName}}.\n\nName: {{name}}\nEmail: {{email}}\n\nAdditional Information:\n{{customFields}}\n\n- Event Registration System",
    },
    passwordReset: {
        subject: "Password Reset for the {{eventName}} Platform",
        body: "Hi,\n\nYou requested a password reset for your event portal account.\n\nClick the link below to reset your password. This link is valid for one hour.\n{{resetLink}}\n\nIf you did not request this, please ignore this email.\n\n- The {{hostName}} Team",
    },
    delegateInvitation: {
      subject: "Invitation to attend {{eventName}}!",
      body: "Hi there,\n\n{{inviterName}} has invited you to attend the {{eventName}}.\n\nClick the link below to complete your registration:\n{{inviteLink}}\n\nWe look forward to seeing you there!\n- The {{hostName}} Team",
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
  },
  whatsapp: {
    enabled: false,
    accessToken: '',
    phoneNumberId: '',
  },
  sms: {
    enabled: false,
    provider: 'twilio',
    accountSid: '',
    authToken: '',
    fromNumber: '',
  }
};
