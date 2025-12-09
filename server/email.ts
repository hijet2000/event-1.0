
import { type EmailPayload, type EventConfig } from '../types';

/**
 * Mocks sending an email via a backend service. It dynamically chooses
 * the sending method based on the provided application configuration and
 * performs basic validation on the settings.
 * @param {EmailPayload} payload - The email details.
 * @param {EventConfig} config - The full application configuration.
 * @returns {Promise<void>} A promise that resolves when the email is "sent".
 * @throws {Error} If the email configuration is invalid or missing.
 */
export const sendEmail = async (payload: EmailPayload, config: EventConfig): Promise<void> => {
  
  if (config.emailProvider === 'google') {
    console.log(`
    ================================================
    SIMULATED GOOGLE EMAIL SERVICE: Sending email...
    ------------------------------------------------`);
    if (!config.googleConfig?.serviceAccountKeyJson) {
      const errorMessage = "ERROR: Google provider selected but no Service Account Key is configured. Email sending failed.";
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    try {
        const json = JSON.parse(config.googleConfig.serviceAccountKeyJson);
        if (!json.project_id || !json.client_email) {
             throw new Error("Service Account JSON missing required fields (project_id, client_email).");
        }
        console.log(`Authenticating with Google Service Account (Project: ${json.project_id})...`);
    } catch (e) {
        const errorMessage = `ERROR: Invalid Service Account JSON. ${(e as Error).message}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
  } else {
    // Default to SMTP
    const smtpConfig = config.smtp;
    console.log(`
    ================================================
    SIMULATED SMTP SERVICE: Sending email...
    ------------------------------------------------`);
    if (!smtpConfig || !smtpConfig.host || !smtpConfig.port || !smtpConfig.username) {
        const errorMessage = `ERROR: SMTP provider selected but required settings are missing (host, port, or username). Email sending failed.`;
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
    console.log(`Connecting to: ${smtpConfig.host}:${smtpConfig.port}`);
    console.log(`Using encryption: ${smtpConfig.encryption.toUpperCase()}`);
    console.log(`Authenticating as: ${smtpConfig.username}`);
    console.log(`Password provided: ${smtpConfig.password ? 'Yes' : 'No'}`);
  }
  
  console.log(`
    ------------------------------------------------
    TO: ${payload.to}
    SUBJECT: ${payload.subject}
    ------------------------------------------------
    BODY:
    ${payload.body}
    ================================================
  `);
  
  // Simulate network delay for an API call
  return new Promise(resolve => setTimeout(resolve, 500));
};
