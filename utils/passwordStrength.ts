
// utils/passwordStrength.ts
export type PasswordStrengthResult = {
  score: 0 | 1 | 2 | 3 | 4;
  label: '' | 'Too Short' | 'Weak' | 'Medium' | 'Strong' | 'Very Strong';
};

/**
 * Calculates the strength of a given password.
 * @param password The password string to evaluate.
 * @returns A PasswordStrengthResult object with a score and a label.
 */
export const checkPasswordStrength = (password: string): PasswordStrengthResult => {
  if (!password) {
    return { score: 0, label: '' };
  }

  let score = 0;
  
  // Criteria checks
  const length = password.length;
  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  // Base score based on length
  if (length >= 8) score += 1;
  if (length >= 12) score += 1;

  // Bonus points for variety
  const varietyCount = [hasLowerCase, hasUpperCase, hasNumber, hasSpecialChar].filter(Boolean).length;
  if (varietyCount >= 3) score += 1;
  if (varietyCount === 4) score += 1;

  // Penalties
  if (length < 8) score = Math.min(score, 1); // Cap score if too short

  // Ensure score is within range
  const finalScore = Math.min(Math.max(score, 0), 4) as PasswordStrengthResult['score'];

  switch (finalScore) {
    case 0: return { score: 0, label: 'Too Short' };
    case 1: return { score: 1, label: 'Weak' };
    case 2: return { score: 2, label: 'Medium' };
    case 3: return { score: 3, label: 'Strong' };
    case 4: return { score: 4, label: 'Very Strong' };
    default: return { score: 0, label: '' };
  }
};