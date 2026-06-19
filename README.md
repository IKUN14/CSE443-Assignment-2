# TGV-style Online Cinema Ticket Reservation System

Focused prototype for the assignment:

- Real-time queue management
- Real-time waitlist notification
- Supabase-backed session persistence

## Folders

- `ticketing-app` - Expo React Native mobile prototype
- `ticketing-server` - Node.js + Express + Socket.IO backend API
- `supabase` - SQL schema for the persisted demo state

## Run locally

1. Create your Supabase project, then run the SQL in `supabase/schema.sql` to create the `users`, `tickets`, `notifications`, and `session_states` tables.

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

The backend persists users to `users`, bookings to `tickets`, notification history to `notifications`, and live demo state to `session_states`.

4. Start the Expo app:

```bash
cd ticketing-app
npm install
npm start
```

5. Open the app in Expo Go, a simulator, or the web target from the Expo CLI.

The backend root URL (`http://localhost:3001`) returns a JSON health-style response. The user and admin demo screens live in the Expo app.

## Demo flow

1. Open the Expo app in two browser/device sessions if you want to simulate two customers.
2. Use the `User A` / `User B` pill to switch demo identity.
3. Book a movie, move through the queue, and trigger sold-out / waitlist states from the in-app Admin screen.

The Expo app is the primary demo surface.
