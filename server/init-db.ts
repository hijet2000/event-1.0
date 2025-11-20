
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import bcrypt from 'bcrypt';

// Fix for missing Node.js types and shadowed globals
declare var process: any;
declare var __dirname: string;

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
    const client = await pool.connect();
    try {
        console.log('🔌 Connected to database...');

        // Read schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('⚙️  Running schema migrations...');
        await client.query(schemaSql);
        console.log('✅ Schema applied successfully.');

        // Seed Initial Roles
        console.log('🌱 Seeding roles...');
        const permissions = [
            'view_dashboard', 'manage_registrations', 'manage_settings', 'manage_users',
            'manage_tasks', 'manage_dining', 'manage_accommodation', 'manage_agenda',
            'manage_speakers_sponsors', 'view_eventcoin_dashboard', 'send_invitations'
        ];
        
        const checkRole = await client.query('SELECT id FROM roles WHERE id = $1', ['role_super_admin']);
        if (checkRole.rows.length === 0) {
             await client.query(
                'INSERT INTO roles (id, name, description, permissions) VALUES ($1, $2, $3, $4)',
                ['role_super_admin', 'Super Admin', 'Full access to all system features.', permissions]
            );
            console.log('   Created Super Admin role.');
        }

        // Seed Initial Admin User
        console.log('🌱 Seeding default admin user...');
        const adminEmail = 'admin@example.com';
        const checkUser = await client.query('SELECT id FROM admin_users WHERE email = $1', [adminEmail]);
        
        if (checkUser.rows.length === 0) {
            const passwordHash = await bcrypt.hash('password', 10);
            await client.query(
                'INSERT INTO admin_users (id, email, password_hash, role_id, created_at) VALUES ($1, $2, $3, $4, $5)',
                ['user_admin_01', adminEmail, passwordHash, 'role_super_admin', Date.now()]
            );
            console.log('   Created default admin: admin@example.com / password');
        } else {
            console.log('   Default admin already exists.');
        }
        
        // Seed Default Event
        console.log('🌱 Seeding default event...');
         const checkEvent = await client.query('SELECT id FROM events WHERE id = $1', ['main-event']);
         if (checkEvent.rows.length === 0) {
             // We insert a minimal config, the app handles defaults if missing
             await client.query(
                 'INSERT INTO events (id, name, config, created_at) VALUES ($1, $2, $3, $4)',
                 ['main-event', 'Tech Summit 2025', '{}', Date.now()]
             );
             console.log('   Created default event: main-event');
         }

        console.log('✨ Database initialization complete!');
    } catch (err) {
        console.error('❌ Database initialization failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

initDb();