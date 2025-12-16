
import { GoogleGenAI, Type } from "@google/genai";
import { type RegistrationData, type EventConfig, type EmailContent, type NetworkingProfile } from '../types';

// Helper to initialize the client lazily for Backend
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
      console.warn("Gemini API Key is missing in backend environment.");
  }
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

const registrationResponseSchema = {
  type: Type.OBJECT,
  properties: {
    userEmail: {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING },
        body: { type: Type.STRING },
      },
      required: ['subject', 'body'],
    },
    hostEmail: {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING },
        body: { type: Type.STRING },
      },
      required: ['subject', 'body'],
    },
  },
  required: ['userEmail', 'hostEmail'],
};

export const generateRegistrationEmails = async (
  registrationData: RegistrationData,
  config: EventConfig,
  verificationLink: string,
  qrCodeUrl: string
): Promise<{ userEmail: EmailContent; hostEmail: EmailContent }> => {
  
  const ai = getAiClient();
  const { name, email, ...customData } = registrationData;
  const { event, emailTemplates, formFields, host } = config;

  const customFieldsString = formFields
    .filter(field => field.enabled && customData[field.id])
    .map(field => `${field.label}: ${customData[field.id]}`)
    .join('\n');

  const prompt = `
    Based on the provided JSON templates and delegate data, please populate the placeholders and return the final email content for an event registration.
    
    Delegate Data:
    - name: "${name}"
    - email: "${email}"
    
    Event Data:
    - eventName: "${event.name}"
    - eventDate: "${event.date}"
    - eventLocation: "${event.location}"
    - hostName: "${host.name}"

    Verification Link:
    - verificationLink: "${verificationLink}"
    
    QR Code URL:
    - qrCodeUrl: "${qrCodeUrl}"

    Custom Fields Data String:
    - customFields: "${customFieldsString || 'No additional information provided.'}"

    Email Templates (JSON):
    ${JSON.stringify({
        userConfirmation: emailTemplates.userConfirmation,
        hostNotification: emailTemplates.hostNotification
    }, null, 2)}

    Now, generate the final JSON output with all placeholders filled.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: registrationResponseSchema,
      },
    });

    const parsedResponse = JSON.parse(response.text || '{}');
    return parsedResponse;

  } catch (error) {
    console.error("Error generating emails with Gemini API:", error);
    throw new Error("Failed to generate registration emails.");
  }
};

export const researchEntity = async (type: 'speaker' | 'sponsor', name: string) => {
    const ai = getAiClient();
    const prompt = type === 'speaker'
        ? `Research "${name}" (Speaker). Find their Title, Company, Bio (max 3 sentences), LinkedIn URL, and Twitter/X URL. Format output as a JSON block with keys: title, company, bio, linkedinUrl, twitterUrl.`
        : `Research "${name}" (Company). Find their Description (max 3 sentences) and Website URL. Format output as a JSON block with keys: description, websiteUrl.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        const text = response.text || '';
        const match = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        const jsonStr = match ? match[1] : text;
        
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            return null;
        }
    } catch (e) {
        console.error("Research failed:", e);
        throw new Error("Failed to research entity.");
    }
};

export const generateMarketingVideo = async (prompt: string, imageBase64?: string): Promise<string> => {
  const ai = getAiClient();
  try {
    let operation;
    if (imageBase64) {
        const base64Data = imageBase64.split(',')[1]; 
        const mimeType = imageBase64.substring(imageBase64.indexOf(':') + 1, imageBase64.indexOf(';'));
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: {
                imageBytes: base64Data,
                mimeType: mimeType,
            },
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
    } else {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: { numberOfVideos: 1, resolution: '1080p', aspectRatio: '16:9' }
        });
    }

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation completed but no URI returned.");

    const apiKey = process.env.API_KEY;
    const response = await fetch(`${downloadLink}&key=${apiKey}`);
    if (!response.ok) throw new Error("Failed to download generated video.");
    
    // In backend context, we might stream this or save to disk. 
    // Here we return the download URL or handle it as a buffer if needed by the controller.
    // For simplicity in this architecture, we'll return the download link and let the controller fetch it to save.
    return downloadLink; 
    
  } catch (error) {
    console.error("Error generating video:", error);
    throw new Error("Failed to generate video.");
  }
};

export const generateAiContent = async (type: string, context: any) => {
    const ai = getAiClient();
    let prompt = `Generate content for ${type} using ${JSON.stringify(context)}`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || '';
    } catch(e) {
        return "";
    }
};

export const generateImage = async (prompt: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
    });
    return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
};

export const summarizeSessionFeedback = async (sessionTitle: string, comments: string[]): Promise<string> => {
    const ai = getAiClient();
    if (comments.length === 0) return "No feedback comments available to analyze.";
    
    const prompt = `
        Analyze the following feedback comments for the session titled "${sessionTitle}".
        Provide a concise summary of themes, positive points, and areas for improvement.
        
        Comments:
        ${comments.join('\n- ')}
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "No summary generated.";
    } catch (e) {
        console.error("Feedback analysis failed", e);
        return "Failed to analyze feedback.";
    }
};

const SYSTEM_DOCUMENTATION = `
You are a helpful Technical Support Assistant for the Event Registration Platform.
Your goal is to explain how the system works and help users troubleshoot issues.

MODULE DOCUMENTATION:

1. Dashboard
- Overview of event stats: Total Registrations, Capacity, and Financials.
- Includes a task list and a countdown timer.
- Quick Actions allow fast navigation to common tasks.

2. Registrations
- Displays list of all attendees.
- Features:
  - Check-in: Use 'Scan' button to check in via QR code or 'Manual Entry' for ID/Email.
  - Export: Download CSV of all attendees or PDF of badges.
  - Import: Bulk upload attendees via CSV (Format: name, email).
  - Edit: Click an attendee to edit details or send updates.

3. Agenda & Speakers
- Agenda: Manage sessions. Drag and drop not supported yet, use 'Edit' form.
- Auto-fill: Use AI to generate session descriptions based on titles.
- Speakers: Manage profiles. AI can research bios from the web.
- Live Polls: Create polls for sessions. Use Projector Mode to display results.

4. Directory (Sponsors)
- Manage sponsor profiles and tiers (Platinum, Gold, Silver, Bronze).
- AI can auto-generate descriptions based on company names.

5. Ticketing & Payments
- Define ticket tiers (VIP, General Admission).
- Set prices and limits.
- Supports Stripe integration (currently in mock mode for demo).

6. Communications
- Send emails to attendees.
- Broadcast: Send bulk messages via Email, SMS, or App Notification.
- Logs: View history of sent messages.

7. Gamification (Scavenger Hunt)
- Create challenges with secret codes.
- Generate QR codes for each challenge.
- Delegates scan codes to earn points on the leaderboard.

8. Venue Maps
- Upload floor plans.
- Add interactive pins for rooms, booths, or info points.

9. Settings
- Configure Event Name, Dates, and Branding (Colors, Logo).
- Email Provider: Switch between SMTP and Google Workspace.
- Integrations: GitHub sync for config backup.

10. Media Library
- Upload images and videos.
- Generate images using Imagen 3 AI.
- Generate marketing videos using Google Veo.

11. Kiosk Mode
- A dedicated, full-screen view for self-service check-in.
- Supports camera scanning and auto-printing badges.

TROUBLESHOOTING TIPS:
- If emails aren't sending, check the 'Communications' -> 'Settings' tab to verify SMTP/Google credentials.
- If QR scanning fails, ensure camera permissions are allowed in the browser.
- If AI features fail, check if the API Key is valid and has quota.

Answer questions concisely based on this info. If asked about code, explain the feature logic, not the implementation details.
`;

export const askSystemHelp = async (query: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `
        ${SYSTEM_DOCUMENTATION}
        
        USER QUESTION: "${query}"
        
        Provide a helpful, step-by-step answer or explanation.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "I couldn't find an answer to that. Please check the documentation manually.";
    } catch (e) {
        console.error("Help query failed", e);
        return "I'm having trouble connecting to the knowledge base right now.";
    }
};
