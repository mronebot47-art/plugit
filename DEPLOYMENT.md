# PlugIt — Production Deployment & Mobile APK Guide

This guide details how to run **PlugIt** on a live public website and install it as an Android APK on mobile phones with **zero dependency on localhost**.

---

## 1. Architecture Overview (Zero-Localhost)

PlugIt consists of two decoupled services:
1. **Frontend**: Next.js 16 Web & Mobile Cockpit (App Router, MapLibre GL, Tailwind CSS).
2. **Backend**: Hono Microservice API (`/backend`, frozen OpenAPI contract, OSRM routing, Open Charge Map + Community chargers store).

```
                      +-----------------------------+
                      |       PlugIt User           |
                      |  (Web Browser / Android APK)|
                      +--------------+--------------+
                                     |
               HTTPS (Public Domain or Mobile Scheme)
                                     |
                      +--------------v--------------+
                      |      Next.js Frontend       |
                      |  (Vercel / Docker / Cloud)  |
                      +--------------+--------------+
                                     |
            REST & SSE via NEXT_PUBLIC_API_URL
                                     |
                      +--------------v--------------+
                      |     Hono Backend Service    |
                      | (Railway / Render / Docker) |
                      +--------------+--------------+
                                     |
                     +---------------+---------------+
                     |                               |
             +-------v-------+               +-------v-------+
             |   OSRM API    |               |  Open Charge  |
             | (Live Routing)|               |  Map & Store  |
             +---------------+               +---------------+
```

---

## 2. Deploying the Live Website (No Localhost)

### Step 2.1: Deploy the Backend Service (Hono)
Deploy the backend to any cloud container platform (Railway, Render, Fly.io, or VPS).

#### Option A: 1-Click Railway / Render (Recommended)
1. Push your repository to GitHub.
2. In Railway or Render, create a **New Web Service** pointing to this repo.
3. Configure the service:
   - **Build Command**: `npm ci --legacy-peer-deps`
   - **Start Command**: `npm run server`
   - **Port**: `8000` (or leave default, read via `$PORT`)
4. Set Environment Variables:
   - `PORT=8000`
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS=*` (or comma-separated list of your frontend domains)
   - `OCM_API_KEY=1c38a50a-5c0e-425c-85af-52e3fb934136`
5. Note your public backend URL (e.g., `https://plugit-api.up.railway.app`).

#### Option B: Docker Container
Run the included `Dockerfile.backend`:
```bash
docker build -f Dockerfile.backend -t plugit-backend .
docker run -d -p 8000:8000 -e PORT=8000 -e ALLOWED_ORIGINS="*" plugit-backend
```

---

### Step 2.2: Deploy the Frontend (Next.js)
Deploy the frontend to Vercel, Netlify, or any Cloud server.

#### Option A: Vercel (Recommended)
1. Import your GitHub repository into Vercel.
2. Set Environment Variables:
   - `NEXT_PUBLIC_API_URL`: Your deployed backend URL (e.g., `https://plugit-api.up.railway.app` — **no trailing slash**).
   - `NEXT_PUBLIC_MAPTILER_KEY`: `1c38a50a-5c0e-425c-85af-52e3fb934136`
3. Click **Deploy**.
4. Your site is now live at `https://your-plugit-app.vercel.app`!

#### Option B: Docker Compose (Unified VPS Deployment)
To run both backend and frontend on a single VPS (e.g., DigitalOcean, Hetzner, AWS EC2):
```bash
# 1. Edit docker-compose.yml with your server domain
# 2. Launch both services
docker compose up -d --build
```
The frontend is served on port `3000` and the backend on port `8000`.

---

## 3. Running as an Android APK on Your Phone

The project is fully integrated with **Capacitor 8** and configured with a native Android Gradle project in `/android`.

### Step 3.1: Build the Android APK
Run the build script from the repository root:
```bash
# Windows
npm run build:apk

# Or manually:
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

The compiled Android APK is generated at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 3.2: Installing the APK on an Android Phone

#### Method 1: Transfer Directly to Phone (No Computer Cable Needed)
1. Copy `android/app/build/outputs/apk/debug/app-debug.apk` to your phone:
   - Upload to **Google Drive**, **Telegram "Saved Messages"**, or **WhatsApp**.
   - Or send via USB cable / Bluetooth.
2. On your Android phone, tap the downloaded `app-debug.apk`.
3. If prompted, allow *"Install unknown apps"*.
4. Tap **Install**. PlugIt is now installed as a native Android app!

#### Method 2: Direct Install via USB (ADB)
If your phone is plugged in with USB Debugging enabled:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

### Step 3.3: Pointing the APK to Your Live Deployed Website

By default, Capacitor apps can load your live hosted web app inside the native Android container. This allows instant updates on the phone whenever you push to GitHub, with zero APK re-installation!

1. Open `capacitor.config.ts`.
2. Set `serverUrl` or environment variable `CAPACITOR_SERVER_URL`:
   ```typescript
   // capacitor.config.ts
   server: {
     url: 'https://your-plugit-app.vercel.app',
     cleartext: true,
     androidScheme: 'https'
   }
   ```
3. Sync and rebuild:
   ```bash
   npx cap sync android
   cd android && .\gradlew.bat assembleDebug
   ```

---

## 4. Progressive Web App (PWA) Direct Mobile Install

If you do not wish to compile an APK:
1. Open your deployed URL (e.g. `https://your-plugit-app.vercel.app`) in **Google Chrome** or **Samsung Internet** on your Android phone.
2. Tap the browser menu (3 dots) in the top right.
3. Select **"Install app"** or **"Add to Home screen"**.
4. PlugIt installs with its native icon, high-contrast dark theme splash screen, and runs full-screen without browser URL bars!

---

## 5. Verification Checklist

| Check | Expected Result | Status |
| :--- | :--- | :---: |
| Backend CORS | Allows external domains, wildcards, and `capacitor://localhost` | ✅ Verified |
| API Base URL | Reads dynamically from `NEXT_PUBLIC_API_URL` or LAN hostname | ✅ Verified |
| MapLibre GL Worker | Bundled locally in `/public/maplibre-gl-worker.mjs` | ✅ Verified |
| Community Chargers | Functional in mobile sheet and map view | ✅ Verified |
| Android Gradle Build | Builds clean `app-debug.apk` with JDK 17 | ✅ Verified |
