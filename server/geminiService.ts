
import { GoogleGenAI, Type } from "@google/genai";
import { type RegistrationData, type EventConfig, type EmailContent, type NetworkingProfile } from '../types';

// Initialize client using named parameter and direct process.env reference
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

export const generateRegistrationEmails = async (
  registrationData: RegistrationData,
  config: EventConfig,
  verificationLink: string,
  qrCodeUrl: string
): Promise<{ userEmail: EmailContent; hostEmail: EmailContent }> => {
  
  const ai = getAiClient();
  const { name, email, goals, ...customData } = registrationData;
  const { event, emailTemplates, formFields, host } = config;

  const customFieldsString = formFields
    .filter(field => field.enabled && customData[field.id])
    .map(field => `${field.label}: ${customData[field.id]}`)
    .join('\n');

  // Bespoke prompt for deep personalization
  const prompt = `
    You are an expert event concierge. A delegate named "${name}" has just registered for "${event.name}".
    
    The delegate submitted a specific "Custom Request / Goal" for their attendance: 
    "${goals || 'General interest in networking and learning.'}"

    Please generate two emails in JSON format based on the templates below.

    USER CONFIRMATION EMAIL (userEmail):
    1. Populate the basic placeholders: eventName, name, eventDate, eventLocation, qrCodeUrl.
    2. Crucially, add a section at the very bottom titled "Personalized AI Strategy".
    3. In this section, analyze their goal and provide 3 specific, expert pieces of advice on how they can maximize their time at this event (e.g. which sessions to look for, who to network with, or questions to ask). Make it sound intelligent, empathetic, and bespoke.

    HOST NOTIFICATION EMAIL (hostEmail):
    1. Summarize the delegate's custom request for the organizers.
    2. Add a short "Actionable Host Tip" for the event organizers (e.g., "This person is looking for investors, consider introducing them to Sponsor X").

    Event Data:
    - Date: "${event.date}"
    - Location: "${event.location}"
    - Host: "${host.name}"

    Templates:
    ${JSON.stringify({
        user: emailTemplates.userConfirmation,
        host: emailTemplates.hostNotification
    }, null, 2)}

    Output must be strictly JSON matching the responseSchema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    // Return safe fallback if AI fails
    return {
        userEmail: {
            subject: `Confirmed: ${event.name}`,
            body: `Hi ${name}, your registration is confirmed. We look forward to seeing you at ${event.location}!`
        },
        hostEmail: {
            subject: `New Delegate: ${name}`,
            body: `Delegate ${name} (${email}) has registered.`
        }
    };
  }
};

export const researchEntity = async (type: 'speaker' | 'sponsor', name: string) => {
    const ai = getAiClient();
    const prompt = type === 'speaker'
        ? `Research "${name}" (Speaker). Find their Title, Company, Bio (max 3 sentences), LinkedIn URL, and Twitter/X URL. Format output as a JSON block with keys: title, company, bio, linkedinUrl, twitterUrl.`
        : `Research "${name}" (Company). Find their Description (max 3 sentences) and Website URL. Format output as a JSON block with keys: description, websiteUrl.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || '';
    } catch(e) {
        return "";
    }
};

export const generateImage = async (prompt: string) => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
          parts: [
              { text: prompt }
          ]
      },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64EncodeString: string = part.inlineData.data;
            return `data:image/png;base64,${base64EncodeString}`;
        }
    }
    throw new Error("Failed to generate image.");
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
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "No summary generated.";
    } catch (e) {
        console.error("Feedback analysis failed", e);
        return "Failed to analyze feedback.";
    }
};

export const askSystemHelp = async (query: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `
        You are a technical support agent for an event platform. Help the user with: "${query}"
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "I couldn't find an answer to that.";
    } catch (e) {
        return "I'm having trouble connecting to the knowledge base right now.";
    }
};

export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `Translate to ${targetLanguage}: "${text}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
        });
        return response.text || text;
    } catch (e) {
        return text;
    }
};

export const analyzeIncidentImage = async (base64Image: string, userDescription: string): Promise<{ category: string, severity: 'low' | 'medium' | 'high' }> => {
    const ai = getAiClient();
    const data = base64Image.split(',')[1];
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';'));

    const prompt = `
        Analyze this incident report. Description: "${userDescription}"
        Categorize (Medical, Security, Technical, Cleaning, Facilities, Other) and find severity (low, medium, high). Return JSON.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
                parts: [
                    { inlineData: { data, mimeType } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        category: { type: Type.STRING },
                        severity: { type: Type.STRING, enum: ['low', 'medium', 'high'] }
                    },
                    required: ['category', 'severity']
                }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { category: 'Other', severity: 'low' };
    }
};
