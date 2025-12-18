
import { GoogleGenAI, Type } from "@google/genai";
import { type RegistrationData, type EventConfig, type EmailContent, type NetworkingProfile } from '../types';

// Updated: Initialize client using named parameter and direct process.env reference
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
    // Updated: Use gemini-3-flash-preview for text tasks
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: registrationResponseSchema,
      },
    });

    // Correctly accessing .text property (not a method)
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
        // Updated: Use gemini-3-flash-preview for text tasks with search
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        // Correctly accessing .text property (not a method)
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

    // Updated: Use process.env.API_KEY directly as per guidelines
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) throw new Error("Failed to download generated video.");
    
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
        // Updated: Use gemini-3-flash-preview for text tasks
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        // Correctly accessing .text property (not a method)
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
        // Updated: Use gemini-3-flash-preview for text tasks
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        // Correctly accessing .text property (not a method)
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
... [rest of the string]
`;

export const askSystemHelp = async (query: string): Promise<string> => {
    const ai = getAiClient();
    const prompt = `
        ${SYSTEM_DOCUMENTATION}
        
        USER QUESTION: "${query}"
        
        Provide a helpful, step-by-step answer or explanation.
    `;
    
    try {
        // Updated: Use gemini-3-flash-preview for text tasks
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        // Correctly accessing .text property (not a method)
        return response.text || "I couldn't find an answer to that. Please check the documentation manually.";
    } catch (e) {
        console.error("Help query failed", e);
        return "I'm having trouble connecting to the knowledge base right now.";
    }
};
