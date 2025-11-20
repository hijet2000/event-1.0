
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { type RegistrationData, type EventConfig, type EmailContent, type NetworkingProfile, type NetworkingMatch } from '../types';
import { getEnv } from './env';

// Helper to initialize the client lazily.
const getAiClient = () => {
  const apiKey = getEnv('API_KEY');
  if (!apiKey) {
      console.warn("Gemini API Key is missing. AI features will not work.");
  }
  return new GoogleGenAI({ apiKey });
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

// Schema for a single email
const singleEmailResponseSchema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
  },
  required: ['subject', 'body'],
};

// Schema for Networking Matches
const networkingMatchesSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
        userId: { type: Type.STRING, description: "The ID of the matching candidate" },
        score: { type: Type.NUMBER, description: "Compatibility score between 0 and 100" },
        reason: { type: Type.STRING, description: "Why this person is a good match (1 sentence)" },
        icebreaker: { type: Type.STRING, description: "A suggested conversation starter question" }
    },
    required: ['userId', 'score', 'reason', 'icebreaker']
  }
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
    The placeholders are enclosed in double curly braces, e.g., {{name}}.

    Available placeholders:
    - {{name}}: Delegate's full name.
    - {{email}}: Delegate's email address.
    - {{eventName}}: The name of the event.
    - {{eventDate}}: The date of the event.
    - {{eventLocation}}: The location of the event.
    - {{hostName}}: The name of the event host.
    - {{customFields}}: A formatted string of all additional data provided by the user.
    - {{verificationLink}}: The unique link for the user to verify their email.
    - {{qrCodeUrl}}: A URL to an image of the delegate's unique QR code.

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
  const ai = getAiClient();
  const { event, emailTemplates, host } = config;
  const template = emailTemplates.passwordReset;

  const prompt = `
    Based on the provided JSON template and data, please populate the placeholders and return the final email content as a single JSON object for an event platform.
    The placeholders are enclosed in double curly braces, e.g., {{eventName}}.

    Available placeholders:
    - {{eventName}}: The name of the event.
    - {{resetLink}}: The unique link for the user to reset their password.
    - {{hostName}}: The name of the event host.

    Event Data:
    - eventName: "${event.name}"
    - hostName: "${host.name}"
    
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
    return JSON.parse(response.text || '{}');
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
  const ai = getAiClient();
  const { event, emailTemplates, host } = config;
  const template = emailTemplates.delegateInvitation;

  const prompt = `
    Based on the provided JSON template and data, please populate the placeholders and return the final email content for an event invitation as a single JSON object.
    The placeholders are enclosed in double curly braces, e.g., {{eventName}}.

    Available placeholders:
    - {{eventName}}: The name of the event.
    - {{inviterName}}: The name of the person sending the invitation (e.g., an admin).
    - {{inviteLink}}: The unique link for the prospective delegate to register.
    - {{hostName}}: The name of the event host.

    Event Data:
    - eventName: "${event.name}"
    - hostName: "${host.name}"
    
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
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Error generating delegate invitation email with Gemini API:", error);
    throw new Error("Failed to generate delegate invitation email.");
  }
};

export const generateDelegateUpdateEmail = async (
    config: EventConfig,
    delegate: RegistrationData
): Promise<EmailContent> => {
    const ai = getAiClient();
    const { name, ...customData } = delegate;
    const { event, formFields, host } = config;
    
    const customFieldsString = formFields
        .filter(field => field.enabled && customData[field.id])
        .map(field => `${field.label}: ${customData[field.id]}`)
        .join('\n');

    const prompt = `
        Write a professional and friendly email to an event delegate named "${name}". 
        The email should inform them that their registration details have been updated and provide a summary of their current information.
        The event is called "${event.name}". The email should be signed by "The ${host.name} Team".
        
        Here is the delegate's current information:
        - Name: ${name}
        - Email: ${delegate.email}
        - Additional Details:
        ${customFieldsString || 'No additional information provided.'}

        Generate a JSON object with "subject" and "body" fields for this email. 
        The subject should be something like "Update regarding your registration for {{eventName}}".
        The body should greet the delegate by name, state that their information has been updated, and then clearly list their current details as provided above.
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
        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("Error generating delegate update email with Gemini API:", error);
        throw new Error("Failed to generate delegate update email.");
    }
};

export const generateAiContent = async (
    type: 'hotel' | 'room' | 'menu' | 'meal_plan' | 'session' | 'speaker_bio' | 'sponsor_description',
    context: Record<string, string>
): Promise<string> => {
    const ai = getAiClient();
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
            prompt = `Generate a sample dinner menu for a restaurant named "${context.name}" that serves ${context.cuisine} cuisine. Include 3 appetizers, 4 main courses, and 2 desserts. Format the output as plain text with clear headings.`;
            break;
        case 'session':
            prompt = `Generate a compelling, professional-sounding description for an event session. The session title is "${context.title}". The speakers are "${context.speakers}". The description should be about 2-4 sentences long and make it sound interesting for attendees.`;
            break;
        case 'speaker_bio':
            prompt = `Generate a professional and engaging third-person biography for a speaker at a tech conference. The biography should be approximately 3-4 sentences long. Speaker's Name: ${context.name}. Title: ${context.title}. Company: ${context.company}.`;
            break;
        case 'sponsor_description':
            prompt = `Generate a compelling and professional one-paragraph description for a company that is sponsoring an event. Company Name: ${context.name}. Company Website: ${context.websiteUrl}.`;
            break;
        default:
            throw new Error("Invalid content type for generation.");
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || '';
    } catch(e) {
        console.error("Error generating content with Gemini:", e);
        throw new Error("Failed to generate content.");
    }
};

export const generateImage = async (prompt: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
      },
    });

    const base64ImageBytes = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  } catch (error) {
    console.error("Error generating image with Gemini API:", error);
    throw new Error("Failed to generate image.");
  }
};

export const generateNetworkingMatches = async (
    userProfile: NetworkingProfile,
    candidates: NetworkingProfile[]
): Promise<any[]> => {
    const ai = getAiClient();

    // Filter candidates to remove self if passed, though UI should handle this
    const others = candidates.filter(c => c.userId !== userProfile.userId).slice(0, 20); // Limit to 20 for performance
    
    if (others.length === 0) return [];

    const prompt = `
        Act as an expert event networking assistant.
        I will provide the profile of the "Active User" and a list of "Candidates".
        Your goal is to analyze their professional backgrounds, interests, and goals to identify the best networking matches for the Active User.

        Active User Profile:
        - Job Title: ${userProfile.jobTitle}
        - Company: ${userProfile.company}
        - Bio: ${userProfile.bio}
        - Interests: ${userProfile.interests.join(', ')}
        - Looking For: ${userProfile.lookingFor}

        Candidates List (JSON):
        ${JSON.stringify(others.map(c => ({
            userId: c.userId,
            jobTitle: c.jobTitle,
            company: c.company,
            bio: c.bio,
            interests: c.interests,
            lookingFor: c.lookingFor
        })))}

        For each candidate that has a compatibility score > 40, generate a match object.
        - Score: 0-100 based on relevance of industry, shared interests, or complementary goals (e.g. looking for hiring vs looking for job).
        - Reason: A concise sentence explaining why they should connect.
        - Icebreaker: A fun or professional question the Active User can ask to start the conversation.

        Return a JSON array of matches.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: networkingMatchesSchema
            }
        });
        
        return JSON.parse(response.text || '[]');
    } catch (e) {
        console.error("Networking AI match failed:", e);
        return [];
    }
};

export const summarizeSessionFeedback = async (
    sessionTitle: string,
    comments: string[]
): Promise<string> => {
    const ai = getAiClient();
    
    if (!comments || comments.length === 0) return "No comments available to analyze.";

    const prompt = `
        Analyze the following attendee feedback comments for the event session titled "${sessionTitle}".
        Summarize the general sentiment in 2-3 sentences. Highlight what people liked and any common criticisms or suggestions.
        
        Comments:
        ${comments.map(c => `- ${c}`).join('\n')}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "Could not generate summary.";
    } catch (e) {
        console.error("Feedback summary failed:", e);
        return "Error generating summary.";
    }
};
