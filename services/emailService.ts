
import { type EmailPayload } from '../types';

/**
 * Mocks sending an email. In a real application, this would use an email service
 * like SendGrid, Mailgun, or a backend API endpoint.
 * @param {EmailPayload} payload - The email details.
 * @returns {Promise<void>} A promise that resolves when the "email" is "sent".
 */
export const sendEmail = async (payload: EmailPayload): Promise<void> => {
  console.log(`
    ================================================
    MOCK EMAIL SERVICE: Sending email...
    ------------------------------------------------
    TO: ${payload.to}
    SUBJECT: ${payload.subject}
    ------------------------------------------------
    BODY:
    ${payload.body}
    ================================================
  `);
  
  // Simulate network delay
  return new Promise(resolve => setTimeout(resolve, 500));
};