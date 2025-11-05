// utils/passwordStrength.ts
export type PasswordStrengthResult = {
  score: 0 | 1 | 2 | 3 | 4;
  label: '' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong';
};

/**
 * Calculates the strength of a given password.
 * @param password The password string to evaluate.
 * @returns A PasswordStrengthResult object with a score and a label.
 */
export const checkPasswordStrength = (password: string): PasswordStrengthResult => {
  let score = 0;
  // Don't show anything until the password is at least 8 characters.
  // The form's own validation will show a "too short" error on submit.
  if (!password || password.length < 8) {
    return { score: 0, label: '' };
  }

  // Base score for meeting the minimum length requirement
  score++;

  // Add points for character variety
  const variety = [
    /[a-z]/.test(password),      // lowercase
    /[A-Z]/.test(password),      // uppercase
    /\d/.test(password),         // numbers
    /[^A-Za-z0-9]/.test(password) // special characters
  ].filter(Boolean).length;

  if (variety > 1) score++; // Has at least two types of characters
  if (variety > 2) score++; // Has at least three types of characters

  // Add a final point for being longer than 12 characters
  if (password.length >= 12) {
    score++;
  }

  // Ensure score doesn't exceed the max of 4
  const finalScore = Math.min(score, 4) as PasswordStrengthResult['score'];

  switch (finalScore) {
    case 1: return { score: 1, label: 'Weak' };
    case 2: return { score: 2, label: 'Medium' };
    case 3: return { score: 3, label: 'Strong' };
    case 4: return { score: 4, label: 'Very Strong' };
    default: return { score: 0, label: '' };
  }
};
