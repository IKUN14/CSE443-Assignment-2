# TGV-Style Cinema Ticketing Prototype

Focused prototype for the assignment:

- Real-time queue management
- Real-time waitlist notification
- Supabase-backed session persistence

## Folders

- `ticketing-app` - Expo React Native mobile prototype
- `ticketing-server` - Node.js + Express + Socket.IO backend with browser user/admin pages
- `supabase` - SQL schema for the persisted demo state

## Run locally

1. Create your Supabase project, then run the SQL in `supabase/schema.sql` to create the `session_states` and `notifications` tables.

2. Configure environment variables:

```bash
export SUPABASE_URL="https://iwmvgsmgpuaqsyyopodh.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export EXPO_PUBLIC_SOCKET_URL="http://127.0.0.1:3001"
export EXPO_PUBLIC_API_BASE_URL="http://127.0.0.1:3001"
```

You can also put the same values in `.env` at the repo root or in `ticketing-server/.env`; the server loads both automatically.

3. Start the server:

```bash
cd ticketing-server
npm install
npm start
```

The backend persists session state to `session_states` and notification history to `notifications`.

4. Open the browser user demo:

```text
http://localhost:3001
```

5. Open the admin dashboard:

```text
http://localhost:3001/admin.html
```

## Demo flow

1. Open the user page in two tabs.
2. Use the `User A` / `User B` pill to switch demo identity.
3. Book a movie, move through the queue, and trigger sold-out / waitlist states from the admin page.

The browser user page is the primary demo surface. The Expo prototype remains in the repository for reference.
