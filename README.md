# Rewardly Backend + Admin Panel

Production-ready backend for **Rewardly**, a gamified rewards mobile app, with a React admin dashboard.

## Tech Stack

- **Backend:** Node.js, Express.js, MongoDB (Mongoose)
- **Auth:** Google Sign-In (mobile users) + JWT; Admin email/password + separate JWT
- **Push:** Firebase Cloud Messaging (FCM) via Firebase Admin SDK
- **Cron:** node-cron (daily/monthly resets + winner finalization at midnight IST)
- **Admin Panel:** React + Vite + Tailwind CSS

## Project Structure

```
rewardlyBackend/
├── admin-panel/          # React admin dashboard
├── config/               # DB, Firebase, seed
├── controllers/          # Route handlers
├── cron/                 # Scheduled jobs
├── middlewares/          # Auth, validation, errors
├── models/               # Mongoose schemas
├── routes/               # API routes
├── scripts/              # Standalone seed script
├── utils/                # JWT, Firebase, helpers
├── server.js             # Entry point
└── .env.example
```

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Google OAuth Client ID (for mobile Google Sign-In)
- Firebase project with service account JSON (for push notifications)

## Setup

### 1. Clone and install dependencies

```bash
cd rewardlyBackend
npm install
cd admin-panel && npm install && cd ..
```

### 2. Environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for user JWT tokens |
| `JWT_ADMIN_SECRET` | Secret for admin JWT tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Firebase service account JSON |
| `ADMIN_EMAIL` | Default admin email (seeded on first run) |
| `ADMIN_PASSWORD` | Default admin password (seeded on first run) |

### 3. Firebase setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project → Project Settings → Service Accounts
3. Generate a new private key (downloads a JSON file)
4. Save it as `firebase-service-account.json` in the project root
5. Set `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json` in `.env`

Push notifications are optional — the server starts without Firebase but skips FCM sends.

### 4. Google Sign-In setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials (Web or Android client ID)
3. Set `GOOGLE_CLIENT_ID` in `.env`

### 5. Run the backend

```bash
npm run dev
```

On first start, the server automatically seeds:
- Default admin user (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Default Settings document

Or run seed manually:

```bash
npm run seed
```

### 6. Run the admin panel

```bash
cd admin-panel
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and log in with your admin credentials.

Default: `admin@rewardly.com` / `Admin@123456`

## API Overview

### Auth (public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/google` | Google Sign-In, returns JWT + user |

### User APIs (Bearer user JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/home` | Home screen data |
| GET | `/api/score?type=today\|monthly` | Leaderboard |
| GET | `/api/rewards/history` | Reward history (paginated) |
| GET | `/api/winners?type=today\|monthly` | Winner lists |
| GET | `/api/notifications` | Notifications (paginated) |
| POST | `/api/notifications/:id/read` | Mark notification read |
| POST | `/api/game/play` | Play game, earn points |
| PUT | `/api/user/device-token` | Update FCM device token |

### Admin APIs (Bearer admin JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET | `/api/admin/users` | User list (search, sort, paginate) |
| GET | `/api/admin/users/:id` | User detail + histories |
| PUT | `/api/admin/users/:id/block` | Toggle block/unblock |
| GET/PUT | `/api/admin/settings` | App settings |
| POST | `/api/admin/notification` | Send push notification |
| POST | `/api/admin/winners/finalize` | Manually finalize winners |
| GET | `/api/admin/winners` | View winners |

## Cron Jobs (IST)

- **Daily (00:00 IST):** Finalize daily top-3 winners, reset `todayGamePoints` and `leftGame`
- **Monthly (1st, 00:00 IST):** Finalize monthly top-3 winners, reset `monthGamePoints`

## Error Format

All errors return consistent JSON:

```json
{
  "success": false,
  "message": "Error description"
}
```

## Production Notes

- Change all secrets in `.env` before deploying
- Use HTTPS in production
- Set `NODE_ENV=production`
- Build admin panel: `cd admin-panel && npm run build` — serve `dist/` via nginx or similar
- Consider MongoDB indexes for leaderboard queries at scale

## License

MIT
