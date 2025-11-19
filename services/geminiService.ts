
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { type RegistrationData, type EventConfig, type EmailContent } from '../types';

// Helper to initialize the client lazily.
// This prevents top-level access to process.env which can cause crashes on load in browser environments.
const getAiClient = () => {
  // Safety check for process.env to avoid ReferenceError in browser if not polyfilled
  const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
  if (!apiKey) {
      console.warn("Gemini API Key is missing or process.env is not accessible.");
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
            prompt = `Generate a sample dinner menu for a restaurant named "${context.name}" that serves ${context.cuisine} cuisine. Include 3 appetizers, 4 main courses, and 2 desserts. Format the output as plain text with clear headings (e.g., "Appetizers", "Main Courses", "Desserts"). Do not include prices.`;
            break;
        case 'session':
            prompt = `Generate a compelling, professional-sounding description for an event session. The session title is "${context.title}". The speakers are "${context.speakers}". The description should be about 2-4 sentences long and make it sound interesting for attendees. Do not repeat the title or speaker names in the description itself.`;
            break;
        case 'speaker_bio':
            prompt = `Generate a professional and engaging third-person biography for a speaker at a tech conference. The biography should be approximately 3-4 sentences long. Speaker's Name: ${context.name}. Title: ${context.title}. Company: ${context.company}.`;
            break;
        case 'sponsor_description':
            prompt = `Generate a compelling and professional one-paragraph description for a company that is sponsoring an event. Company Name: ${context.name}. Company Website: ${context.websiteUrl}. The description should highlight their mission or key area of expertise.`;
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

    const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
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
