# Event Platform Backend

This directory contains the code for the production backend of the Event Registration Platform.

## Prerequisites

- **Node.js** (v18 or higher)
- **PostgreSQL** Database
- **Google Gemini API Key**

## Setup

1.  **Install Dependencies:**
    Navigate to the root folder (or wherever you place `backend.ts`) and run:
    ```bash
    npm install express cors pg dotenv @google/genai body-parser jsonwebtoken bcrypt
    npm install --save-dev @types/express @types/cors @types/pg @types/node @types/jsonwebtoken @types/bcrypt ts-node typescript
    ```

2.  **Database Setup:**
    - Create a new PostgreSQL database (e.g., `event_db`).
    - Run the contents of `schema.sql` against your database to create the necessary tables and initial data.

3.  **Environment Variables:**
    Create a `.env` file in this directory with the following credentials:
    ```env
    PORT=3001
    DATABASE_URL=postgresql://user:password@localhost:5432/event_db
    API_KEY=your_gemini_api_key_here
    JWT_SECRET=some_super_secure_random_string
    ```

## Running the Server

You can run the server directly using `ts-node`:

```bash
npx ts-node server/backend.ts
```

The server will start on port 3001 (or whatever you defined in `.env`).

## Migrating Frontend to Production

Currently, the frontend (`api.ts`) uses a mock in-memory database (`store.ts`). To connect the frontend to this real backend:

1.  Modify `server/api.ts` to remove the imports from `./db` and `./store`.
2.  Replace the function implementations in `api.ts` to use `fetch()` calls to your new backend API.

**Example Migration:**

*Old `server/api.ts`:*
```typescript
export const getPublicEventData = async (eventId: string) => {
    const event = await find('events', ...);
    return event.config;
};
```

*New `server/api.ts` (Production):*
```typescript
const API_URL = 'http://localhost:3001/api';

export const getPublicEventData = async (eventId: string) => {
    const res = await fetch(`${API_URL}/events/${eventId}`);
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
};
```
