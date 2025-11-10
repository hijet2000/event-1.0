// Mocks bcrypt. In a real app, use the actual 'bcrypt' library.
export const hashPassword = async (password: string): Promise<string> => {
  // Simple "hashing" for mock purposes
  return Promise.resolve(`hashed_${password}`);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return Promise.resolve(`hashed_${password}` === hash);
};

// Mocks JWT. In a real app, use a library like 'jsonwebtoken'.
interface TokenPayload {
  id: string;
  email: string;
  permissions?: any[];
  type: 'admin' | 'delegate';
  // FIX: Added optional eventId to support multi-event contexts.
  eventId?: string;
  iat: number;
  exp: number;
}

export const generateToken = (payload: Omit<TokenPayload, 'iat' | 'exp'>): string => {
  const iat = Date.now();
  const exp = iat + (1000 * 60 * 60 * 24); // 24 hours
  const fullPayload: TokenPayload = { ...payload, iat, exp };
  return btoa(JSON.stringify(fullPayload));
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) {
      console.warn('Token expired');
      return null;
    }
    return payload as TokenPayload;
  } catch (error) {
    console.error('Invalid token', error);
    return null;
  }
};
