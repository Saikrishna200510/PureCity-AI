# PureCity AI — Urban Air Quality Assistant

> **Cleaner Cities. Smarter Air. Healthier Lives.**

**PureCity AI** is a full-stack, AI-powered Urban Air Quality Assistant built with **React + Vite + Tailwind CSS + Firebase + Google Gemini API + Leaflet + Recharts** for **Hack2Skill Challenge 6 – Urban Air Quality Assistant**.

---

## Key Capabilities

1. **User Authentication & Profiles** (`Firebase Authentication` + `Cloud Firestore`)
   - Email/Password registration, login, password reset, Google Sign-In, persistent sessions, protected routes, and post-registration city/activity preferences.
2. **Live Air Quality Dashboard** (`Open-Meteo Copernicus CAMS` + optional `OpenAQ v3`)
   - Real-time AQI, PM2.5, PM10, NO₂, O₃, SO₂, CO, temperature, humidity, and wind speed.
   - Dual **US EPA AQI** and **Indian CPCB NAQI** calculation and standard switcher.
   - Explicit data source attribution, last-updated timestamp, and automatic cached fallback notice if live APIs are unreachable (never displays fabricated real-time numbers).
   - Initial demonstration location: **Guntur, Andhra Pradesh, India**.
3. **City Search, Geolocation & Comparison**
   - Global city/area search via Open-Meteo Geocoding, browser GPS detection, Firestore `favoriteLocations`, and side-by-side 3-city live comparison.
4. **Conversational AI Air Quality Assistant** (`Google Gemini` via `@google/genai` `gemini-4-hydrogen`)
   - Grounded strictly in the selected city's live readings and user activity/sensitivity profile.
   - Multi-turn conversation persistence in Firestore `chatHistory`.
   - Enforces safety boundaries: never invents measurements and never provides medical diagnoses.
5. **Interactive Pollution Hotspot Map** (`Leaflet` + `OpenStreetMap`)
   - Color-coded AQI markers for regional grid points and OpenAQ ground monitoring stations (when configured), plus toggleable verified citizen reports.
6. **Historical & Comparative Analytics** (`Recharts`)
   - 48-hour hourly trends, 2/7/14-day daily trends, PM2.5 vs PM10 trajectories, multi-city comparisons, and Firestore `airQualityReadings` archive table.
7. **Personalized Activity Recommendations**
   - Tailored guidance for Walking, Running, Cycling, Outdoor Work, and General Outdoor Activities across sensitivity groups.
8. **Pollution Alerts & Notifications** (`userAlerts` + scheduled Cloud Function)
   - Custom AQI threshold rules per location with a 60-minute cooldown to avoid spam.
9. **Citizen Pollution Reporting & Moderation** (`Firestore` + `Firebase Storage`)
   - Submit reports with category, description, timestamp, optional GPS coordinates, and optional image upload (`<= 5MB`), clearly separated from verified sensor measurements.
10. **Role-Based Admin Console**
    - Total user/system statistics, citizen report moderation (`verify` / `flag` / `reject`), user role management, and global settings (`adminSettings`).

---

## Project Structure

```text
├── public/
├── src/
│   ├── components/         # CitySearchBar, AqiCards, ProtectedRoute
│   ├── contexts/           # AuthContext, LocationContext
│   ├── firebase/           # Firebase client SDK & emulator initialization
│   ├── layouts/            # Responsive DashboardLayout with sidebar
│   ├── pages/              # All 12 application pages
│   ├── services/           # airQualityService, firestoreService, apiClient
│   ├── utils/              # AQI (US + Indian CPCB) & recommendation engines
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── functions/
│   ├── index.js            # Express Cloud Function API + Scheduled hourly sync
│   ├── utils/aqi.js        # Backend AQI calculation helpers
│   ├── scripts/setAdmin.js # Server-side admin role bootstrap script
│   └── .env.example
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── .firebaserc
├── .env.example
└── vite.config.js
```

---

## Firebase Plan & External API Cost Notes

- **Free / Zero-Cost Tier (Spark Plan + Open-Meteo)**:
  - Firebase Authentication, Cloud Firestore (within daily quotas), Firebase Hosting, and Open-Meteo Air Quality/Weather/Geocoding APIs run on free tiers without billing.
  - OpenAQ v3 API offers a free developer API key (`OPENAQ_API_KEY`).
  - Google Gemini API offers a free tier via Google AI Studio (`GEMINI_API_KEY`).
- **Requires Firebase Blaze (Pay-as-you-go) Plan**:
  - **Cloud Functions for Firebase (v2)** (`api` endpoint for Gemini AI proxy, OpenAQ proxy, admin APIs) and **Cloud Scheduler** (`scheduledAirQualityAndAlerts` hourly job) require upgrading your Firebase project to the **Blaze plan** (includes a generous monthly free invocation allowance, so small hackathon demos typically incur \$0).

---

## Local Development Setup

### 1. Prerequisites
- Node.js 20+ (tested on Node 22)
- Firebase CLI (`npm install -g firebase-tools`)

### 2. Install Dependencies
```bash
npm install
npm --prefix functions install
```

### 3. Configure Environment Variables
1. Copy `.env.example` to `.env` and fill in your Firebase Web App config (from **Firebase Console -> Project Settings -> Your Apps**):
   ```bash
   cp .env.example .env
   ```
2. Copy `functions/.env.example` to `functions/.env` and set your keys:
   ```bash
   cp functions/.env.example functions/.env
   ```
   - `GEMINI_API_KEY`: Get from [Google AI Studio](https://aistudio.google.com/apikey)
   - `OPENAQ_API_KEY` *(optional)*: Get from [OpenAQ Explorer](https://explore.openaq.org/register)

### 4. Run Locally
- **Frontend only** (live Open-Meteo AQI, Firebase Auth, Firestore, Storage, Maps, Analytics):
  ```bash
  npm run dev
  ```
- **Full Stack with Firebase Emulators** (includes Cloud Functions + Gemini AI locally):
  Set `VITE_USE_EMULATORS=true` in `.env` (or test against live Firebase project with `firebase emulators:start --only functions`) and run:
  ```bash
  firebase emulators:start
  npm run dev
  ```

---

## Firebase Setup & Deployment Guide

### 1. Create & Link Firebase Project
```bash
firebase login
firebase init
```
Or update `.firebaserc` with your Firebase Project ID (`"default": "your-project-id"`).

### 2. Enable Services in Firebase Console
1. **Authentication**: Enable **Email/Password** and **Google** sign-in providers. Add your hosting domain (and `localhost` for local testing) under **Authorized domains**.
2. **Cloud Firestore**: Create a Firestore database in production mode.
3. **Firebase Storage**: Initialize the default Cloud Storage bucket.
4. **Upgrade to Blaze Plan** *(required for Cloud Functions & Scheduler)*.

### 3. Build & Deploy
```bash
# Build production React bundle
npm run build

# Deploy security rules & indexes first
firebase deploy --only firestore:rules,firestore:indexes,storage

# Deploy Cloud Functions & Firebase Hosting
firebase deploy
```

### 4. Grant Initial Administrator Role (Secure Server-Side Script)
Users can **never** assign themselves an admin role from the client. To promote a user to admin:
```bash
cd functions
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json node scripts/setAdmin.js admin@example.com
```
