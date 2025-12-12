
import { GoogleGenAI, Type } from "@google/genai";
import { type RegistrationData, type EventConfig, type EmailContent, type NetworkingProfile } from '../types';

// Helper to initialize the client lazily.
// We strictly use process.env.API_KEY as per coding guidelines.
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
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

const singleEmailResponseSchema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
  },
  required: ['subject', 'body'],
};

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
    Populate the placeholders for a password reset email.
    
    Event Data:
    - eventName: "${event.name}"
    - hostName: "${host.name}"
    
    Reset Link:
    - resetLink: "${resetLink}"

    Email Template (JSON):
    ${JSON.stringify(template, null, 2)}
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
    console.error("Error generating password reset email:", error);
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
    Populate the placeholders for an invitation email.

    Event Data:
    - eventName: "${event.name}"
    - hostName: "${host.name}"
    
    Invitation Data:
    - inviterName: "${inviterName}"
    - inviteLink: "${inviteLink}"

    Email Template (JSON):
    ${JSON.stringify(template, null, 2)}
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
    console.error("Error generating invitation email:", error);
    throw new Error("Failed to generate invitation email.");
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
        Write a professional email to "${name}" about their updated registration for "${event.name}".
        Signed by "The ${host.name} Team".
        
        Details:
        - Name: ${name}
        - Email: ${delegate.email}
        - Additional:
        ${customFieldsString || 'None'}
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
        console.error("Error generating update email:", error);
        throw new Error("Failed to generate delegate update email.");
    }
};

export const generateWaitlistPromotionEmail = async (
    config: EventConfig,
    delegate: RegistrationData
): Promise<EmailContent> => {
    const ai = getAiClient();
    const { name } = delegate;
    const { event, host } = config;

    const prompt = `
        Write an exciting and professional email to "${name}" informing them that a spot has opened up for "${event.name}" and they have been moved from the waitlist to confirmed status.
        Signed by "The ${host.name} Team".
        
        Include details:
        - Event Date: ${event.date}
        - Location: ${event.location}
        
        The subject should be catchy like "You're in! Your spot at ${event.name} is confirmed".
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
        console.error("Error generating waitlist promotion email:", error);
        throw new Error("Failed to generate promotion email.");
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
            prompt = `Generate a 2-3 sentence description for a hotel named "${context.name}" located at "${context.address}".`;
            break;
        case 'room':
             prompt = `Generate a 1 sentence description for a "${context.name}" hotel room.`;
            break;
        case 'meal_plan':
            prompt = `Generate a 1 sentence description for a meal plan called "${context.name}".`;
            break;
        case 'menu':
            prompt = `Generate a sample menu for "${context.name}" (${context.cuisine}). Include 3 appetizers, 4 mains, 2 desserts. Text only.`;
            break;
        case 'session':
            prompt = `Generate a 2-3 sentence description for a session "${context.title}" with speakers "${context.speakers}".`;
            break;
        case 'speaker_bio':
            prompt = `Generate a 3-4 sentence bio for ${context.name}, ${context.title} at ${context.company}.`;
            break;
        case 'sponsor_description':
            prompt = `Generate a 1 paragraph description for sponsor "${context.name}" (${context.websiteUrl}).`;
            break;
        default:
            return "Content generation not supported for this type.";
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || '';
    } catch(e) {
        console.error("Error generating content:", e);
        return "Failed to generate content.";
    }
};

export const generateChatReply = async (
    message: string,
    context: string
): Promise<string> => {
    const ai = getAiClient();
    const prompt = `
        You are an intelligent event concierge bot.
        Context about the event: ${context}
        
        User Message: "${message}"
        
        Respond briefly, helpfully, and professionally. If you don't know the answer based on the context, politely say so and suggest contacting the organizer.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "I'm sorry, I couldn't process that.";
    } catch (e) {
        console.error("Chat reply generation failed", e);
        return "I'm currently having trouble connecting to the event services. Please try again later.";
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
    console.error("Error generating image:", error);
    throw new Error("Failed to generate image.");
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
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });
    } else {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '1080p',
                aspectRatio: '16:9'
            }
        });
    }

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation completed but no URI returned.");
    }

    const apiKey = process.env.API_KEY;
    const response = await fetch(`${downloadLink}&key=${apiKey}`);
    if (!response.ok) {
        throw new Error("Failed to download generated video.");
    }
    
    const videoBlob = await response.blob();
    return URL.createObjectURL(videoBlob);

  } catch (error) {
    console.error("Error generating video with Gemini API:", error);
    throw new Error("Failed to generate video.");
  }
};

export const generateNetworkingMatches = async (
    userProfile: NetworkingProfile,
    candidates: NetworkingProfile[]
): Promise<any[]> => {
    const ai = getAiClient();
    const others = candidates.filter(c => c.userId !== userProfile.userId).slice(0, 20);
    
    if (others.length === 0) return [];

    const prompt = `
        Match "${userProfile.jobTitle} at ${userProfile.company}" with candidates.
        Interests: ${userProfile.interests.join(', ')}.
        Looking for: ${userProfile.lookingFor}.

        Candidates:
        ${JSON.stringify(others.map(c => ({
            userId: c.userId,
            jobTitle: c.jobTitle,
            company: c.company,
            interests: c.interests,
            lookingFor: c.lookingFor
        })))}

        Return matches > 40% compatibility as JSON array.
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
        console.error("Networking match failed:", e);
        return [];
    }
};

export const summarizeSessionFeedback = async (
    sessionTitle: string,
    comments: string[]
): Promise<string> => {
    const ai = getAiClient();
    if (!comments || comments.length === 0) return "No comments.";

    const prompt = `Summarize these comments for "${sessionTitle}":\n${comments.map(c => `- ${c}`).join('\n')}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text || "Could not summarize.";
    } catch (e) {
        console.error("Feedback summary failed:", e);
        return "Error generating summary.";
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
        // Parse JSON from Markdown block if present
        const match = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        const jsonStr = match ? match[1] : text;
        
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.warn("Failed to parse JSON from research result", text);
            return null;
        }
    } catch (e) {
        console.error("Research failed:", e);
        throw new Error("Failed to research entity.");
    }
};
