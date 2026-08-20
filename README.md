# M.A.T. PHOTOBOOTH // INDUSTRIAL PHOTO-SYS

**M.A.T. Photobooth** is an offline-first Windows photobooth kiosk featuring an **Industrial Neo-Brutalist & Tactical Telemetry Interface** with private, time-limited cloud delivery via Supabase.

The system captures 4 photos through a live optical webcam (or deterministic mock camera), allows guests to review the full set, composites a 300 DPI framed photo collage locally using Sharp, uploads it to an isolated private cloud bucket via authenticated Edge Functions, and generates a verified guest QR code for instant, fragment-based secure retrieval.

---

## Architecture Overview

- **`apps/kiosk`**: Authoritative Electron 43 desktop application, sandboxed React 19 renderer, local SQLite state with Drizzle ORM, AES-256-GCM encrypted local storage with `safeStorage`, background image composition worker (Sharp), upload retry queue, and Windows NSIS packaging.
- **`apps/public`**: Fast, lightweight React + Vite web application (deployable to Vercel/Cloudflare) for zero-knowledge, fragment-based photo retrieval (`/photo#<token>`).
- **`packages/shared`**: Shared Zod validation schemas, IPC types, telemetry contracts, and domain types.
- **`supabase`**: PostgreSQL database migrations, Row-Level Security (RLS) policies, private Storage bucket, Deno-based Edge Functions, Vault secrets, and `pg_cron` cleanup jobs.

---

## 1. Prerequisites & Toolchain

Ensure your workstation meets the following requirements:

- **Operating System**: Windows 11 / Windows 10 x64 (for Kiosk), cross-platform (macOS/Linux) for Web & Shared packages.
- **Node.js**: `v24.x`
- **Package Manager**: `pnpm v11.x` (managed via Corepack)
- **Deno**: `v2.x` (for Supabase Edge Functions testing/development)
- **Docker Desktop**: (Optional) required only if running the local Supabase container test suite.
- **Camera**: Built-in laptop webcam, USB UVC camera, or the deterministic mock camera adapter.

---

## 2. Installation & Workspace Setup

1. **Clone the repository**:
   ```powershell
   git clone <repository-url>
   cd photobooth-system
   ```

2. **Enable Corepack & Install Dependencies**:
   ```powershell
   corepack enable
   pnpm install --frozen-lockfile
   ```

3. **Install Playwright Browsers (for E2E tests)**:
   ```powershell
   pnpm exec playwright install chromium
   ```

---

## 3. Cloud & Database Setup (Supabase)

M.A.T. Photobooth uses **Supabase** for secure, time-limited photo delivery. You can set up either a **Hosted Supabase Project** (Production / Staging) or a **Local Docker-backed Supabase Instance**.

### Option A: Hosted Supabase Setup (Recommended)

#### Step 1: Create a Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a new project (Region recommendation: Singapore `ap-southeast-1` or Tokyo `ap-northeast-1`).
2. Note down your **Project URL** and **Publishable Key** (or Anon Key) from **Project Settings > API**.

#### Step 2: Push Database Migrations
From the repository root, link your project and apply the migrations:
```powershell
# Link to your Supabase project (enter your database password when prompted)
pnpm exec supabase link --project-ref <your-project-id>

# Push migrations to the database
pnpm exec supabase db push --workdir supabase
```

#### Step 3: Configure the Private Storage Bucket
1. In Supabase Dashboard, navigate to **Storage**.
2. Create a bucket named `photos`:
   - **Public bucket**: `OFF` (Strictly Private)
   - **File size limit**: `12 MB`
   - **Allowed MIME types**: `image/jpeg`

#### Step 4: Enroll Booth Device Account
Create a dedicated Supabase Auth user for your booth kiosk:
1. In Supabase Dashboard, go to **Authentication > Users** and click **Add User**.
   - **Email**: `booth1@matphotobooth.local` (or your chosen email)
   - **Password**: `<secure-booth-password>`
   - **Auto Confirm User**: `YES`
2. Copy the newly created user's **UUID**.
3. In **SQL Editor**, enroll this user as an authorized booth device:
   ```sql
   INSERT INTO public.booth_devices (user_id, device_name, enabled)
   VALUES ('<PASTE-USER-UUID-HERE>', 'Main Kiosk 01', true);
   ```

#### Step 5: Configure Edge Function Secrets
Set the required environment secrets for the Supabase Edge Functions:
```powershell
# Set Edge Function secrets
pnpm exec supabase secrets set --workdir supabase `
  PUBLIC_TOKEN_DERIVATION_KEY="<generate-random-32-byte-base64-key>" `
  PUBLIC_PAGE_ORIGIN="http://127.0.0.1:4173" `
  PHOTO_BUCKET="photos" `
  CLEANUP_SECRET="<generate-random-32-character-string>"
```
*(Note: Change `PUBLIC_PAGE_ORIGIN` to your production public web URL, e.g. `https://photos.yourdomain.com`, when deploying to production).*

#### Step 6: Configure Supabase Vault for Cron Cleanup
In the Supabase **SQL Editor**, run the following to store the cleanup credentials in Supabase Vault:
```sql
SELECT vault.create_secret(
  'https://<your-project-id>.supabase.co',
  'grace_booth_project_url'
);

SELECT vault.create_secret(
  '<SAME-VALUE-AS-CLEANUP_SECRET>',
  'grace_booth_cleanup_secret'
);
```

#### Step 7: Deploy Edge Functions
Deploy all 4 backend Edge Functions:
```powershell
pnpm exec supabase functions deploy create-upload --workdir supabase
pnpm exec supabase functions deploy confirm-upload --workdir supabase
pnpm exec supabase functions deploy photo --workdir supabase --no-verify-jwt
pnpm exec supabase functions deploy cleanup-expired --workdir supabase --no-verify-jwt
```

---

### Option B: Local Supabase Development Setup (with Docker)

If you have Docker Desktop running:
```powershell
# Start local Supabase container stack
pnpm supabase:start

# Reset and seed database migrations
pnpm db:reset

# Run database pgTAP tests
pnpm exec supabase test db supabase/tests/database --local --workdir supabase
```

---

## 4. Configuring Environment Variables

### Kiosk Application (`apps/kiosk`)
Set environment variables in your PowerShell session (or Windows system environment):

```powershell
# Camera Adapter: 'webcam' (Default) or 'mock' (Deterministic fixture photos)
$env:GRACE_BOOTH_CAMERA_ADAPTER = "webcam"

# Supabase Cloud Connection (Optional for offline-only mock mode)
$env:GRACE_BOOTH_SUPABASE_URL = "https://<your-project-id>.supabase.co"
$env:GRACE_BOOTH_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_..."
```

### Public Web App (`apps/public`)
Create an `.env` file in `apps/public/` (or set in Vercel / deployment environment):
```env
VITE_PUBLIC_PHOTO_API_URL=https://<your-project-id>.supabase.co/functions/v1/photo
VITE_PUBLIC_PAGE_ORIGIN=https://photos.yourdomain.com
```

---

## 5. How to Run the System

### Running the Kiosk (Desktop App)
To launch the Electron kiosk in development mode with live hot-reload:
```powershell
pnpm dev:kiosk
```

### Running the Public Web App
To run the public photo retrieval site locally:
```powershell
pnpm dev:public
```
The public page serves `/photo#<token>` for guest downloads.

---

## 6. How to Use the System

### Guest User Flow
1. **Attract Screen**: Displays telemetry diagnostics and brand identity. Tap **"START PHOTO-SYS SESSION"**.
2. **Viewfinder & Countdown**: The live camera feed appears. An automated countdown (with frameless timer) counts down for each of the 4 shots.
3. **Review Capture Matrix**: Displays the 4 captures framed on paper mats.
   - Click **"RETAKE ALL PHOTOS"** to discard and retake the 4-shot sequence.
   - Click **"USE THESE PHOTOS"** to accept and proceed to processing.
4. **Processing & Cloud Sync**: The kiosk composites the final photo strip at 300 DPI, uploads it to Supabase Storage, and validates the upload.
5. **Final QR Screen**: Displays the composite photo alongside a secure QR Code. Guests scan the QR code to view and download their photo strip on their phone.
6. Tap **"DONE // FINISH SESSION"** to return to the Attract screen.

### Operator & Admin Panel
1. Click the **"ADMIN"** button in the top-right corner of any screen.
2. Enter the **Operator Passcode** (created on first launch; 8–64 characters).
3. **Frame Editor (`FRAME`)**:
   - Preview and adjust the 4 photo slots on the canvas.
   - Use layout presets (**2×2 Grid**, **4-Strip**, **Hero+3**).
   - Enter precise coordinate percentages (`X`, `Y`, `Width`, `Height`) or select **Crop-to-fill** vs. **Fit**.
   - Click **"Replace Frame"** to upload a new transparent PNG overlay.
4. **Settings & Telemetry (`SETTINGS`)**:
   - **Subsystem Health**: Live diagnostics for Optical hardware, Database, Encrypted storage, and Cloud gateway.
   - **Camera Setup**: Test optical capture feeds, switch camera adapters, or select USB devices.
   - **Cloud Identity**: Sign into the dedicated booth device account (`booth1@...`).
   - **Photo Delivery & Forms**: Configure optional Google Forms URL for event registrations.
   - **Retention Policies**: View locked 30-day cloud / 60-day local retention timers.
   - **Upload Queue Buffer**: Inspect and manually retry pending/failed cloud uploads.

---

## 7. Building for Production

### Package Windows Kiosk (NSIS Installer)
To compile and build the production Windows desktop installer:
```powershell
pnpm build
pnpm dist:win
```
The output installer (`Grace Booth Setup <version>.exe`) will be generated in `apps/kiosk/release/`.

### Build Public Web App
```powershell
pnpm --filter @grace-booth/public build
```
Deploy the `apps/public/dist/` directory to Vercel, Cloudflare Pages, or any static hosting provider.

---

## 8. Verification & Test Suite

Run the full automated test suite across all packages:

```powershell
# Run all unit and component tests (117 tests across shared, public, kiosk, and edge functions)
pnpm test

# Run strict TypeScript typechecking
pnpm typecheck

# Run linter and formatting checks
pnpm lint
pnpm format:check

# Run Deno Edge Function tests
pnpm test:functions

# Run native module integrity self-test under Electron
pnpm native:self-test
```

---

## 9. Security & Data Protection

- **Zero Plaintext Tokens**: Guest bearer tokens are derived on-the-fly via server-side HMAC-SHA256 and never stored in plaintext in the database (only SHA-256 hashes are persisted).
- **URL Fragment Privacy**: QR codes use URL fragments (`https://origin/photo#<token>`). Fragments are never sent in HTTP request headers or server logs.
- **Strict Sandboxing**: The Electron renderer runs in a context-isolated sandbox with no direct access to Node.js, IPC internals, the filesystem, or raw database connections.
- **Local Encryption at Rest**: Local guest photos and session data are encrypted using AES-256-GCM with keys protected by Windows DPAPI via Electron `safeStorage`.
- **Automatic 720-Hour Expiry**: Cloud photos expire exactly 30 days (720 hours) after confirmation and are permanently purged by the automated cleanup cron job.

---

## 10. Troubleshooting & FAQ

### Issue: `Error: Electron uninstall` when running `pnpm dev:kiosk`

**Symptom**:
```text
Error: Electron uninstall
    at getElectronPath (.../electron-vite/dist/chunks/lib-q6ns0vZr.js:155:19)
    at startElectron (...)
```

**Cause**:
`electron-vite` throws this error when the precompiled Electron executable (`electron.exe`) was not downloaded during the initial `pnpm install` (e.g. postinstall script was skipped, interrupted, or blocked by a firewall/proxy).

**Solution**:

1. **Force download / rebuild the Electron binary** (Fastest fix):
   ```powershell
   pnpm rebuild electron
   ```
   *Or run the install script directly:*
   ```powershell
   node node_modules/.pnpm/electron@43.4.0/node_modules/electron/install.js
   ```

2. **If dependencies were partially installed**, run a clean forced install:
   ```powershell
   pnpm install --force
   ```

3. **If behind a corporate proxy, VPN, or firewall** (where GitHub Release downloads are blocked):
   Set the Electron download mirror before rebuilding:
   ```powershell
   # In PowerShell:
   $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
   pnpm rebuild electron
   ```

4. **Verify Node & pnpm Versions**:
   Ensure you are using **Node >= 24** and **pnpm >= 11** as specified in `package.json`:
   ```powershell
   node -v   # Should output v24.x
   pnpm -v   # Should output v11.x
   ```

