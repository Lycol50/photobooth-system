# Grace Booth

Grace Booth is an offline-first Windows photo-booth kiosk with private, time-limited cloud delivery. The MVP captures four photos through a deterministic mock camera, lets guests review or retake the full set, builds a framed collage locally, uploads it through an allowlisted booth identity, and reveals a QR code only after the cloud object has been verified.

The repository is implementation-only. It does not provision Supabase, Vercel, DNS, certificates, camera SDKs, or any hosted resource.

## Repository layout

- `apps/kiosk`: Electron kiosk, local admin, encrypted storage, SQLite state, image worker, upload queue, and Windows packaging.
- `apps/public`: static Vercel page for fragment-based photo retrieval and download.
- `packages/shared`: Zod-validated domain, camera, cloud, snapshot, and typed IPC contracts.
- `supabase`: SQL migrations, private Storage policy, Edge Functions, cleanup schedule, pgTAP, and Deno tests.
- `tests/e2e`: browser and Electron acceptance tests.
- `docs`: security, retention, verification, and Sony integration gates.

## Locked runtime foundation

- Node.js 24.x
- pnpm 11.x
- Electron 43.4
- electron-vite 5 with Vite 7.3
- React 19.2 and TypeScript 6
- Fastify 5.12
- better-sqlite3 13 and Sharp 0.35

Install the exact dependency graph with:

```powershell
corepack enable
pnpm install --frozen-lockfile
```

Use `.env.example` as the configuration reference only when exercising a cloud-connected path. Electron reads inherited OS/service values; Vite may read an ignored root `.env` for the public build. The mock guest flow and most local tests do not need hosted credentials.

A bare local build uses an inert `.invalid` public endpoint so the complete workspace can be verified without hosted credentials. That output cannot resolve photos at a real origin. The approved release workflow must provide both public-page values and regenerate the exact Vercel CSP before deployment.

## Common commands

```powershell
pnpm dev:kiosk
pnpm dev:public
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm native:self-test
pnpm dist:win
pnpm native:self-test:packaged
```

Supabase database tests additionally require Docker Desktop or another compatible container runtime:

```powershell
pnpm supabase:start
pnpm db:reset
pnpm exec supabase test db supabase/tests/database --local --workdir supabase
```

Edge Function checks do not require Docker:

```powershell
pnpm functions:check
pnpm functions:lint
pnpm functions:format:check
pnpm test:functions
```

See [SETUP.md](./SETUP.md) for first-run bootstrap, cloud identity, public-page configuration, and Windows packaging.
The latest workstation results and explicit external-test blocks are recorded in [docs/VERIFICATION.md](./docs/VERIFICATION.md).

## Security model

Electron main is authoritative. It owns countdown timing, legal state transitions, camera access, persistence, image processing, uploads, QR creation, authentication, and cleanup. The sandboxed React renderer receives only validated, sanitized snapshots through a fixed preload bridge. It has no generic IPC, filesystem, process, shell, database, or Supabase access.

Guest media is AES-256-GCM encrypted at rest with a random installation key wrapped by Electron `safeStorage`. Passcodes use serialized built-in scrypt with a fresh 32-byte salt, a 64-byte result, `N=131072`, `r=8`, and `p=1`. There is no default passcode. The first local launch requires an 8 to 64 character operator passcode.

For each owner and client-session idempotency key, `create-upload` derives one stable 32-byte bearer token with a server-only, domain-separated HMAC-SHA256 key. Concurrent or lost-response retries therefore return the same token without storing it in plaintext; Postgres stores only its SHA-256 hash. Electron seals the token immediately. It appears in a QR URL fragment, `https://<public-origin>/photo#<token>`, so it is absent from Vercel and Supabase request paths. The public page sends it only in strict POST bodies. No analytics or third-party renderer requests are used.

Cloud access ends exactly 720 hours after successful confirmation. Local originals, prior retake rounds, previews, and collages are retained for 60 days. Cleanup timing cannot extend public access because every image and download request rechecks the exact expiry.

See [security and retention operations](./docs/SECURITY_AND_RETENTION.md) for the full boundary and incident procedure.

## MVP boundaries

- `MockCameraAdapter` is the supported camera for this build. It uses packaged deterministic JPEG fixtures and honest illustrative preview copy.
- `SonyCameraAdapter` returns `unsupported_pending_model_verification`. No Sony SDK binary is included. The evidence and hardware tests required to proceed are in [the Sony integration gate](./docs/SONY_CAMERA_INTEGRATION.md).
- `MediaPipeCropStrategy` is present as a capability boundary but reports unavailable in the Node worker. The required deterministic center crop remains active.
- Local administration binds to loopback. Optional LAN administration is disabled unless an operator selects a private interface and supplies an HTTPS PFX. Plaintext LAN HTTP is never enabled.
- The generated Windows installer is unsigned and intended only for internal verification. Production requires a code-signing decision and Windows 11 or an actively supported Windows 10 ESU installation.

## Cloud delivery contract

The private `photos` bucket grants no direct anonymous or authenticated reads. A dedicated booth Auth user must be explicitly enabled in `booth_devices`; Electron carries only that user's session and the project publishable key. Edge Functions alone use the server secret.

The delivery sequence is:

1. `create-upload` assigns an opaque object path and returns the session's stable bearer token plus a two-hour upload capability.
2. The kiosk seals the raw token before uploading and keeps the signed upload capability in memory only.
3. `confirm-upload` verifies ownership, token, object bytes, JPEG signature, dimensions, size, type, and SHA-256.
4. Confirmation returns an immutable ready receipt. Only `QrService` accepts that receipt, so a QR cannot be created for pending or unverified media.
5. The public page resolves, displays, and downloads through controlled POST endpoints until the exact expiry.

Detailed deployment preparation is documented in [the Supabase service README](./supabase/README.md) and [the public-page README](./apps/public/README.md). Those steps require separate deployment approval.
