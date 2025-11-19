
import { describe, it, expect } from './testFramework';
import { registerUser, getEventConfig, purchaseEventCoins, getDelegateBalance, sendCoins, updateNetworkingProfile, getMyNetworkingProfile, loginAdmin } from '../server/api';
import { hashPassword, comparePassword } from '../server/auth';
import { db } from '../server/store';

// Helper to create a clean state for tests
const resetTestDb = () => {
    // We don't clear everything to avoid breaking the running app, 
    // but we can create unique IDs for test data.
};

export const registerTestSuites = () => {
    describe('Authentication Module', () => {
        it('should hash and compare passwords correctly', async () => {
            const password = 'secretPassword123';
            const hash = await hashPassword(password);
            
            expect(hash).toBeTruthy();
            expect(hash).toBe('hashed_' + password); // Based on our mock implementation
            
            const isValid = await comparePassword(password, hash);
            expect(isValid).toBe(true);
            
            const isInvalid = await comparePassword('wrong', hash);
            expect(isInvalid).toBe(false);
        });

        it('should allow admin login with correct credentials', async () => {
            const result = await loginAdmin('admin@example.com', 'password');
            expect(result).toBeTruthy();
            if (result) {
                expect(result.user.email).toBe('admin@example.com');
            }
        });

        it('should fail admin login with wrong password', async () => {
            const result = await loginAdmin('admin@example.com', 'wrongpassword');
            expect(result).toBe(null);
        });
    });

    describe('Registration Logic', () => {
        it('should register a new user successfully', async () => {
            const uniqueEmail = `test_${Date.now()}@example.com`;
            const result = await registerUser('main-event', {
                name: 'Test User',
                email: uniqueEmail,
                createdAt: Date.now()
            } as any);
            
            expect(result.success).toBe(true);
        });

        it('should prevent duplicate email registration', async () => {
            const uniqueEmail = `dupe_${Date.now()}@example.com`;
            // First reg
            await registerUser('main-event', {
                name: 'User 1',
                email: uniqueEmail,
                createdAt: Date.now()
            } as any);
            
            // Second reg
            const result = await registerUser('main-event', {
                name: 'User 2',
                email: uniqueEmail,
                createdAt: Date.now()
            } as any);
            
            expect(result.success).toBe(false);
            expect(result.message).toBe('Email already registered.');
        });
    });

    describe('EventCoin Economy', () => {
        it('should process coin purchases', async () => {
            // 1. Create user
            const email = `coin_test_${Date.now()}@example.com`;
            await registerUser('main-event', { name: 'Coin Tester', email, createdAt: Date.now() } as any);
            const user = db.registrations.find((r: any) => r.email === email);
            
            // Mock token (structure doesn't matter much for mock verifyToken unless heavily validated)
            // We need a valid token structure for the API to decode ID
            const token = btoa(JSON.stringify({ id: user.id, email, type: 'delegate', exp: Date.now() + 100000 }));
            
            // 2. Purchase
            await purchaseEventCoins(token, 100, 50);
            
            // 3. Check Balance
            const balanceData = await getDelegateBalance(token);
            // User gets starting balance (100) + purchased (100)
            expect(balanceData.balance).toBeGreaterThan(100); 
        });

        it('should prevent sending more coins than available', async () => {
             const senderEmail = `sender_${Date.now()}@example.com`;
             await registerUser('main-event', { name: 'Sender', email: senderEmail, createdAt: Date.now() } as any);
             const sender = db.registrations.find((r: any) => r.email === senderEmail);
             const token = btoa(JSON.stringify({ id: sender.id, email: senderEmail, type: 'delegate', eventId: 'main-event', exp: Date.now() + 100000 }));
             
             // Try to send 1,000,000 coins
             const recipientEmail = 'admin@example.com'; // exists
             
             await expect(sendCoins(token, recipientEmail, 1000000, 'Test')).toThrow();
        });
    });
    
    describe('Networking', () => {
        it('should create and retrieve a networking profile', async () => {
             const email = `networker_${Date.now()}@example.com`;
             await registerUser('main-event', { name: 'Networker', email, createdAt: Date.now() } as any);
             const user = db.registrations.find((r: any) => r.email === email);
             const token = btoa(JSON.stringify({ id: user.id, email, type: 'delegate', exp: Date.now() + 100000 }));
             
             const profileData = {
                 jobTitle: 'Tester',
                 company: 'Test Co',
                 bio: 'Just testing',
                 interests: ['Testing'],
                 isVisible: true
             };
             
             await updateNetworkingProfile(token, profileData);
             
             const saved = await getMyNetworkingProfile(token);
             expect(saved).toBeTruthy();
             if (saved) {
                 expect(saved.jobTitle).toBe('Tester');
                 expect(saved.company).toBe('Test Co');
             }
        });
    });
};
