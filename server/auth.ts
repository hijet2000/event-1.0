
import { type Permission } from '../types';

// Mock bcrypt hash prefix
const BCRYPT_MOCK_PREFIX = '$2b$10$mock';

export const hashPassword = async (password: string): Promise<string> => {
  // Simple "hashing" for mock purposes that looks like bcrypt
  return Promise.resolve(`${BCRYPT_MOCK_PREFIX}${btoa(password)}`);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  // Check if it's our mock hash
  if (hash.startsWith(BCRYPT_MOCK_PREFIX)) {
      const computed = `${BCRYPT_MOCK_PREFIX}${btoa(password)}`;
      return Promise.resolve(computed === hash);
  }
  // Fallback for real bcrypt hashes (cannot verify real hashes in browser mock mode easily)
  // In a real scenario, this wouldn't happen as offline mode wouldn't share db with online mode effectively
  return Promise.resolve(false);
};

// Standard JWT Payload
interface TokenPayload {
  id: string;
  email: string;
  permissions?: Permission[];
  type: 'admin' | 'delegate';
  eventId?: string;
  iat: number;
  exp: number;
}

// Base64URL helpers
const b64UrlEncode = (str: string) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64UrlDecode = (str: string) => atob(str.replace(/-/g, '+').replace(/_/g, '/'));

export const generateToken = (payload: Omit<TokenPayload, 'iat' | 'exp'>): string => {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + (24 * 60 * 60); // 24 hours expiration
  
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload = { ...payload, iat, exp };
  
  const encodedHeader = b64UrlEncode(JSON.stringify(header));
  const encodedPayload = b64UrlEncode(JSON.stringify(fullPayload));
  const signature = "mock_signature_secret"; // Dummy signature for mock mode
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    const parts = token.split('.');
    
    // Handle standard JWT (3 parts)
    if (parts.length === 3) {
        const payloadJson = b64UrlDecode(parts[1]);
        const payload = JSON.parse(payloadJson) as TokenPayload;
        
        // Check expiry (JWT exp is in seconds)
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
          console.warn('Token expired');
          return null;
        }
        
        return payload;
    } 
    
    // Fallback for legacy base64-only tokens (migration support)
    // Try simple atob of the whole string
    try {
        const legacy = JSON.parse(atob(token));
        // Check legacy exp (milliseconds)
        if (legacy.exp && legacy.exp > Date.now()) return legacy;
    } catch {
        // ignore
    }

    return null;
  } catch (error) {
    console.error('Invalid token format', error);
    return null;
  }
};
