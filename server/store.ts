import { type EventConfig, type RegistrationData, type AdminUser, type Role, type Transaction, type Invitation } from '../types';
import { defaultConfig } from './config';
import { hashPassword } from './auth';

// This file mocks a PostgreSQL database connection and seeding process.
// In a real application, this would use the 'pg' library to connect to a real database.

class MockPool {
  _data: { [key: string]: any[] } = {
    event_configs: [],
    registrations: [],
    transactions: [],
    invitations: [],
    admin_users: [],
    roles: [],
    password_reset_tokens: [],
    tasks: [],
  };
  _seeded = false;

  async query(sql: string, params: any[] = []) {
    const ucSql = sql.toUpperCase();
    
    // Simple SELECT with one WHERE clause
    if (ucSql.startsWith('SELECT')) {
      const fromMatch = ucSql.match(/FROM\s+(\w+)/);
      const table = fromMatch ? fromMatch[1].toLowerCase() : null;
      if (!table || this._data[table] === undefined) return { rows: [], rowCount: 0 };

      let results = [...this._data[table]];
      const whereMatch = sql.match(/WHERE\s+([\w."]+)\s*=\s*\$(\d+)/i);
      if (whereMatch) {
        const field = whereMatch[1].replace(/"/g, '');
        const paramIndex = parseInt(whereMatch[2], 10) - 1;
        if (params[paramIndex] !== undefined) {
          results = results.filter(row => row[field] === params[paramIndex]);
        }
      }

      if (ucSql.includes('COUNT(*)')) {
        return { rows: [{ count: String(results.length) }], rowCount: 1 };
      }
      
      const orderMatch = sql.match(/ORDER BY\s+([\w."]+)\s+(ASC|DESC)/i);
      if(orderMatch) {
          const [_, field, direction] = orderMatch;
          results.sort((a,b) => {
              if (a[field] < b[field]) return direction.toUpperCase() === 'ASC' ? -1 : 1;
              if (a[field] > b[field]) return direction.toUpperCase() === 'ASC' ? 1 : -1;
              return 0;
          });
      }
      
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      if(limitMatch) {
          results = results.slice(0, parseInt(limitMatch[1], 10));
      }

      return { rows: results, rowCount: results.length };
    }

    if (ucSql.startsWith('INSERT INTO')) {
      const tableMatch = ucSql.match(/INTO\s+(\w+)/);
      const table = tableMatch ? tableMatch[1].toLowerCase() : null;
      if (!table || this._data[table] === undefined) throw new Error(`Table ${table} not found`);
      
      const colsMatch = sql.match(/\(([^)]+)\)/);
      const columns = colsMatch ? colsMatch[1].split(',').map(s => s.trim().replace(/"/g, '')) : [];

      const newRow: { [key: string]: any } = {};
      columns.forEach((col, i) => {
        newRow[col] = params[i];
      });
      this._data[table].push(newRow);
      return { rows: [newRow], rowCount: 1 };
    }

    if (ucSql.startsWith('UPDATE')) {
      const tableMatch = ucSql.match(/UPDATE\s+(\w+)/);
      const table = tableMatch ? tableMatch[1].toLowerCase() : null;
      if (!table || this._data[table] === undefined) throw new Error(`Table ${table} not found`);

      const whereMatch = sql.match(/WHERE\s+([\w."]+)\s*=\s*\$(\d+)/i);
      if (!whereMatch) throw new Error("UPDATE without WHERE is not supported in this mock");

      const field = whereMatch[1].replace(/"/g, '');
      const paramIndex = parseInt(whereMatch[2], 10) - 1;
      const value = params[paramIndex];
      
      const setMatch = sql.match(/SET\s+(.*?)\s+WHERE/i);
      if (setMatch) {
        const setClauses = setMatch[1].split(',').map(s => s.trim());
        const updates: { [key: string]: any } = {};
        setClauses.forEach(clause => {
          const [col, paramPlaceholder] = clause.split('=').map(s => s.trim());
          const pIndex = parseInt(paramPlaceholder.replace('$', ''), 10) - 1;
          updates[col.replace(/"/g, '')] = params[pIndex];
        });

        this._data[table].forEach(row => {
          if (row[field] === value) {
            Object.assign(row, updates);
          }
        });
      }
      return { rowCount: 1 };
    }
    
    if (ucSql.startsWith('DELETE FROM')) {
      const tableMatch = ucSql.match(/FROM\s+(\w+)/);
      const table = tableMatch ? tableMatch[1].toLowerCase() : null;
      if (!table || this._data[table] === undefined) throw new Error(`Table ${table} not found`);
      
      const whereMatch = sql.match(/WHERE\s+([\w."]+)\s*=\s*\$(\d+)/i);
       if (whereMatch) {
        const field = whereMatch[1].replace(/"/g, '');
        const paramIndex = parseInt(whereMatch[2], 10) - 1;
        const value = params[paramIndex];
        const originalLength = this._data[table].length;
        this._data[table] = this._data[table].filter(row => row[field] !== value);
        return { rowCount: originalLength - this._data[table].length };
      }
    }

    return { rows: [], rowCount: 0 };
  }
}

const pool = new MockPool();
export const query = pool.query.bind(pool);

const seedData = async () => {
    if (pool._seeded) return;
    pool._seeded = true;
    
    console.log("Seeding PostgreSQL mock database...");

    await query('INSERT INTO event_configs (id, config_data) VALUES ($1, $2)', ['main-event', defaultConfig]);
    
    const superAdminRole: Role = { id: 'role_super_admin', name: 'Super Admin', description: 'Has all permissions.', permissions: ['view_dashboard', 'manage_settings', 'manage_registrations', 'manage_users_roles', 'view_eventcoin_dashboard', 'manage_event_id_design', 'manage_tasks'] };
    await query('INSERT INTO roles (id, name, description, permissions) VALUES ($1, $2, $3, $4)', [superAdminRole.id, superAdminRole.name, superAdminRole.description, superAdminRole.permissions]);

    const adminPasswordHash = await hashPassword('password123');
    await query('INSERT INTO admin_users (id, email, password_hash, role_id) VALUES ($1, $2, $3, $4)', ['user_admin', 'admin@example.com', adminPasswordHash, superAdminRole.id]);

    const delegatePasswordHash = await hashPassword('password123');
    const customFields = { company: 'Delegate Corp', role: 'Test User' };
    await query(
        'INSERT INTO registrations (id, name, email, password_hash, created_at, updated_at, email_verified, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        ['reg_12345', 'John Delegate', 'delegate@example.com', delegatePasswordHash, new Date(), new Date(), true, customFields]
    );

    if (defaultConfig.eventCoin.enabled) {
        await query(
            'INSERT INTO transactions (id, from_email, from_name, to_email, to_name, amount, message, type, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [`tx_${Date.now()}`, 'system', `${defaultConfig.eventCoin.name} Treasury`, 'delegate@example.com', 'John Delegate', defaultConfig.eventCoin.startingBalance, 'Initial balance deposit.', 'initial', new Date()]
        );
    }
    
    // Seed tasks
    await query(
        'INSERT INTO tasks (id, event_id, title, description, status, due_date, created_at, updated_at, assignee_email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        ['task_1', 'main-event', 'Prepare keynote slides', 'Finalize the presentation for the opening keynote.', 'in_progress', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], new Date(), new Date(), 'admin@example.com']
    );
    await query(
        'INSERT INTO tasks (id, event_id, title, description, status, due_date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        ['task_2', 'main-event', 'Confirm catering menu', 'Call the caterer to confirm the final menu and headcount.', 'todo', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], new Date(), new Date()]
    );
     await query(
        'INSERT INTO tasks (id, event_id, title, description, status, due_date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        ['task_4', 'main-event', 'Book guest speaker flights', 'Book round-trip flights for our main guest speaker.', 'todo', new Date().toISOString().split('T')[0], new Date(), new Date()]
    );
    await query(
        'INSERT INTO tasks (id, event_id, title, description, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['task_3', 'main-event', 'Send final attendee list to printer', 'The list for the badges needs to be sent out.', 'completed', new Date(), new Date()]
    );

    console.log("Database seeded successfully.");
};

export const dbReady = seedData();