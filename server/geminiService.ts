import { GoogleGenAI, Type } from "@google/genai";
import { type RegistrationData, type EventConfig, type EmailContent } from '../types';

// Initialize GoogleGenAI with apiKey from environment variables as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

// Schema for a single email
const singleEmailResponseSchema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
  },
  required: ['subject', 'body'],
};


export const generateRegistrationEmails = async (
  registrationData: RegistrationData,
  config: EventConfig,
  verificationLink: string
): Promise<{ userEmail: EmailContent; hostEmail: EmailContent }> => {

  const { name, email, ...customData } = registrationData;
  const { event, emailTemplates, formFields, host } = config;

  const customFieldsString = formFields
    .filter(field => field.enabled && customData[field.id])
    .map(field => `${field.label}: ${customData[field.id]}`)
    .join('\n');

  const prompt = `
    Based on the provided JSON templates and user data, please populate the placeholders and return the final email content.
    The placeholders are enclosed in double curly braces, e.g., {{name}}.

    Available placeholders:
    - {{name}}: User's full name.
    - {{email}}: User's email address.
    - {{eventName}}: The name of the event.
    - {{eventDate}}: The date of the event.
    - {{eventLocation}}: The location of the event.
    - {{hostName}}: The name of the event host.
    - {{customFields}}: A formatted string of all additional data provided by the user.
    - {{verificationLink}}: The unique link for the user to verify their email.

    User Data:
    - name: "${name}"
    - email: "${email}"
    
    Event Data:
    - eventName: "${event.name}"
    - eventDate: "${event.date}"
    - eventLocation: "${event.location}"
    - hostName: "${host.name}"

    Verification Link:
    - verificationLink: "${verificationLink}"

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

    const parsedResponse = JSON.parse(response.text);

    if (parsedResponse.userEmail && parsedResponse.hostEmail) {
      return parsedResponse;
    } else {
      throw new Error("Invalid format received from Gemini API");
    }

  } catch (error) {
    console.error("Error generating emails with Gemini API:", error);
    throw new Error("Failed to generate registration emails.");
  }
};


export const generatePasswordResetEmail = async (
  config: EventConfig,
  resetLink: string
): Promise<EmailContent> => {
  const { event, emailTemplates } = config;
  const template = emailTemplates.passwordReset;

  const prompt = `
    Based on the provided JSON template and data, please populate the placeholders and return the final email content as a single JSON object.
    The placeholders are enclosed in double curly braces, e.g., {{eventName}}.

    Available placeholders:
    - {{eventName}}: The name of the event.
    - {{resetLink}}: The unique link for the user to reset their password.

    Event Data:
    - eventName: "${event.name}"
    
    Reset Link:
    - resetLink: "${resetLink}"

    Email Template (JSON):
    ${JSON.stringify(template, null, 2)}

    Now, generate the final JSON output with all placeholders filled.
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: singleEmailResponseSchema,
      },
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating password reset email with Gemini API:", error);
    throw new Error("Failed to generate password reset email.");
  }
};


export const generateDelegateInvitationEmail = async (
  config: EventConfig,
  inviterName: string,
  inviteLink: string
): Promise<EmailContent> => {
  const { event, emailTemplates } = config;
  const template = emailTemplates.delegateInvitation;

  const prompt = `
    Based on the provided JSON template and data, please populate the placeholders and return the final email content as a single JSON object.
    The placeholders are enclosed in double curly braces, e.g., {{eventName}}.

    Available placeholders:
    - {{eventName}}: The name of the event.
    - {{inviterName}}: The name of the person sending the invitation.
    - {{inviteLink}}: The unique link for the user to register.

    Event Data:
    - eventName: "${event.name}"
    
    Invitation Data:
    - inviterName: "${inviterName}"
    - inviteLink: "${inviteLink}"

    Email Template (JSON):
    ${JSON.stringify(template, null, 2)}

    Now, generate the final JSON output with all placeholders filled.
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: singleEmailResponseSchema,
      },
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating delegate invitation email with Gemini API:", error);
    throw new Error("Failed to generate delegate invitation email.");
  }
};

export const generateHotelContent = async (
    type: 'hotel' | 'room' | 'menu' | 'meal_plan',
    context: Record<string, string>
): Promise<string> => {
    let prompt = '';
    switch(type) {
        case 'hotel':
            prompt = `Generate a compelling, professional-sounding description for a hotel named "${context.name}". The hotel is located at "${context.address}". The description should be about 2-3 sentences long and highlight its suitability for event attendees.`;
            break;
        case 'room':
             prompt = `Generate a brief, appealing description for a "${context.name}" room type at a hotel. Mention some of its key features based on its name. Keep it to one sentence.`;
            break;
        case 'meal_plan':
            prompt = `Generate a brief, one-sentence description for a meal plan called "${context.name}" at an event.`;
            break;
        case 'menu':
            prompt = `Generate a sample dinner menu for a restaurant named "${context.name}" that serves ${context.cuisine} cuisine. Include 3 appetizers, 4 main courses, and 2 desserts. Format the output as plain text with clear headings (e.g., "Appetizers", "Main Courses", "Desserts"). Do not include prices.`;
            break;
        default:
            throw new Error("Invalid content type for generation.");
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch(e) {
        console.error("Error generating content with Gemini:", e);
        throw new Error("Failed to generate content.");
    }
};
