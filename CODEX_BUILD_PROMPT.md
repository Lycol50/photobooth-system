# Codex Build Prompt — Grace Booth Photobooth System

## Objective

Build the complete Grace Booth MVP in `C:\Users\padil\mj\photobooth-system`: a production-oriented, local-first Windows photobooth that faithfully implements the approved Grace Booth UI, captures four photos through an adapter-based camera layer, composites and stores a framed JPEG locally, uploads it securely to Supabase, and displays a QR code only after the public download is confirmed ready.

## Canonical inputs — read these before changing files

1. Product architecture and requirements:
   `C:\Users\padil\mj\obsidian-vault\iMac Vault\6 - Main Notes\photobooth-system\Photobooth System - Architecture and Build Plan.md`
2. Approved UI and interaction reference:
   `C:\Users\padil\mj\grace-booth-wireframes`
3. Target implementation workspace:
   `C:\Users\padil\mj\photobooth-system`

Read every file in the UI-reference directory, including all seven screen HTML files, `styles.css`, `app.js`, and `index.html`, before implementation. Treat the seven artboards, design tokens, typography, spacing, states, layout, copy, and interactions as the visual source of truth. The source directory is read-only reference material.

The architecture note is the source of truth for workflow, security, persistence, retention, and scope. If a prototype interaction conflicts with the architecture note, follow the architecture note while preserving the visual design.

## Starting state

The implementation workspace is currently empty except for planning/setup documentation. Build from scratch. Do not assume existing package configuration, source code, Supabase resources, credentials, or Sony SDK binaries.

The exact Sony A7 model and firmware are unknown. A real Sony implementation is therefore an explicit later integration gate. The complete MVP must work end-to-end with `MockCameraAdapter`; do not fabricate or claim a working production Sony adapter.

## Target state

Create a working pnpm TypeScript monorepo with:

```text
photobooth-system/
  apps/
    kiosk/                       # Electron + React guest/admin application
      src/main/                  # orchestration, camera, DB, queue, Fastify
      src/preload/               # minimal typed Electron bridge
      src/renderer/              # Grace Booth guest/admin React UI
      resources/                 # local UI assets, mock photos, default frame
      tests/
  packages/
    shared/                      # shared types, schemas, state-machine contracts
  supabase/
    config.toml
    migrations/
    functions/
      _shared/
      create-upload/
      confirm-upload/
      photo/
      cleanup-expired/
    tests/
  .env.example
  .gitignore
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  README.md
  SETUP.md                       # preserve and correct if implementation differs
  CODEX_BUILD_PROMPT.md          # preserve this task brief
```

The application must run in mock-camera mode without physical camera hardware and must be capable of local Supabase development through the Supabase CLI.

## Locked product behavior

### Guest flow

1. Guest controls the booth with a mouse on a 1366 × 768 Windows laptop.
2. Attract screen has one unmistakable Start action and a discreet operator-admin entry.
3. One session takes four photos with an eight-second countdown before each capture.
4. The countdown shows `Photo N of 4`, four-step progress, a large countdown, audio cues, and a shutter flash/click.
5. Review shows all four photos. The only decisions are `Retake all photos` and `Use these photos`.
6. Retake restarts the complete four-photo sequence and is unlimited.
7. Processing creates one high-quality JPEG collage, 2500–3000 px on the long edge, using the configured transparent PNG frame and four configured slots.
8. Each slot supports `crop-to-fill` or `fit`. Face-aware positioning may adjust the crop when detection succeeds; center crop is the mandatory fallback.
9. Save the finished collage locally before any cloud request.
10. Upload through the persistent local queue. Never show a QR while upload is pending or unverified.
11. After Supabase confirms the photo-session record is `ready`, generate the QR and show the final collage, QR, 30-day notice, and a large Done button.
12. The final screen has no timeout. Done resets all guest/session state and returns to Attract.

### Failure behavior

- Camera failure: show the approved calm recovery screen and allow an operator-controlled session restart.
- Upload failure: preserve the local collage and queue record, retry automatically with exponential backoff (1 s, 3 s, 8 s), then show `Retry upload` when automatic retries are exhausted.
- Restart recovery: reload incomplete sessions/jobs from SQLite and resume pending uploads.
- Never silently discard captured photos or falsely claim that a QR is ready.
- Never expose stack traces, paths, tokens, credentials, or raw technical errors to guests.

### Admin behavior

- One shared local passcode, stored only as a salted `scrypt` hash using Node's built-in crypto API.
- Admin available on the booth laptop. LAN access must be disabled by default and configurable for a trusted private network.
- Visual frame editor uploads/replaces a transparent PNG and displays four draggable/resizable slots.
- Store slot geometry as normalized coordinates so layouts remain stable across render/export sizes.
- Selected slot inspector: slot name, X, Y, width, height, `crop-to-fill`/`fit`, and reset.
- Settings: Google Forms URL, retention status, upload queue, Retry upload, passcode change, and camera/cloud health.
- No event creation, roles, analytics dashboard, printing, SMS/email delivery, filters, individual-photo retakes, internal ministry-registration database, or arbitrary button collection.

## UI implementation requirements

Rebuild the reference UI as production React components; do not iframe or ship the static presentation.

Preserve the Grace Booth “Resonance & Light / Modern Sanctuary” design language:

- Primary navy/cobalt tokens from `styles.css`, warm/light surfaces, restrained red accent, success/error colors.
- Montserrat display typography, Inter body typography, and JetBrains Mono for counters/technical labels. Bundle fonts locally or provide dependable local fallbacks; the booth must not depend on Google Fonts or any external runtime asset.
- 1366 × 768 artboard composition, large mouse targets, pill buttons, high contrast, clear focus rings, and the exact seven-screen hierarchy.
- Preserve hover, active, disabled, loading, success, and error states.
- Preserve approved UI copy unless a small correction is required for actual system behavior.
- Meet WCAG AA contrast and keyboard-focus visibility. Mouse is primary, but essential actions must remain keyboard-accessible.
- Use reduced-motion preferences. Animation must not delay capture or QR readiness.
- Replace every remote/hot-linked prototype image with local fixtures/assets. No runtime dependency on `lh3.googleusercontent.com` or other third-party image URLs.
- Do not ship the prototype presentation header, screen selector, annotations, or demo-only controls.
- Do not reuse the prototype webcam logic as production capture logic. UI visuals may be reused, but capture must go through `CameraAdapter`.

Create focused components such as `AttractScreen`, `CaptureScreen`, `ReviewScreen`, `ProcessingScreen`, `FinalQrScreen`, `RecoveryScreen`, `FrameEditor`, `AdminSettings`, `ProgressStepper`, `PhotoSlot`, and `QrPanel`. Keep guest-state transitions centralized instead of scattering navigation across components.

## Locked technology choices

- Package manager: pnpm workspaces.
- Language: strict TypeScript throughout.
- Kiosk shell: Electron, electron-vite, React, Vite.
- Windows packaging: electron-builder.
- Local API/admin host: Fastify.
- Local database: SQLite with `better-sqlite3`, Drizzle ORM, and checked-in migrations.
- Validation/contracts: Zod.
- Image processing: Sharp/libvips in the Electron main side or a worker thread, never in the renderer.
- Face detection: MediaPipe behind a `CropStrategy` interface; center-crop fallback is always available.
- QR: `qrcode` generated locally only after readiness confirmation.
- Frame editor direct manipulation: `react-rnd` or a small equivalent implementation; do not introduce a large canvas framework.
- Logging: Pino structured logs with secret/PII redaction.
- Cloud: Supabase Postgres, private Supabase Storage, Auth, and TypeScript/Deno Edge Functions.
- Testing: Vitest, React Testing Library, Playwright Electron tests where appropriate, and SQL/function integration tests.
- Formatting/linting: ESLint and Prettier with root scripts.

These dependencies are pre-approved when they are directly needed for the locked stack. Ask before adding a major framework, cloud vendor, analytics SDK, UI kit, state-management library, or any dependency that duplicates a platform/native capability.

## Electron security and process boundaries

- `contextIsolation: true`
- `nodeIntegration: false`
- sandbox the renderer where supported.
- Use a narrow, typed preload bridge. Never expose raw IPC, filesystem, process, shell, database, or Supabase clients to the renderer.
- Validate every IPC payload with shared Zod schemas.
- Restrict navigation, new windows, external links, permissions, and protocol handlers.
- Open the Google Forms link only through the expected public download page; validate it as HTTPS when saving settings.
- Keep Supabase service/secret keys out of Electron, renderer bundles, logs, SQLite, and committed files.
- Store the dedicated booth Auth refresh session using Electron `safeStorage`, not plain text.
- Store local files beneath Electron's `app.getPath('userData')`, organized into pending, completed, frame, and log directories.
- Perform image processing and long filesystem work outside the renderer/UI thread.

## Camera architecture

Implement:

```ts
interface CameraAdapter {
  connect(): Promise<CameraStatus>;
  getStatus(): Promise<CameraStatus>;
  capture(request: CaptureRequest): Promise<CaptureResult>;
  disconnect(): Promise<void>;
}
```

- `MockCameraAdapter` must use deterministic local test images and support configurable delay/failure injection for tests.
- Add a `SonyCameraAdapter` boundary/stub that reports `unsupported_pending_model_verification` with a clear operator message.
- Add `docs/SONY_CAMERA_INTEGRATION.md` describing the model/firmware compatibility spike, official Sony SDK gate, USB remote-shoot test, and 20-capture soak test.
- Do not automate Imaging Edge via screen scraping or keystrokes.
- Do not add Sony SDK binaries or native bindings until the actual model is known and a human approves the integration approach.

## Local persistence and state machine

Use a single explicit session state machine matching:

```text
attract
→ countdown
→ capturing
→ countdown (until four captures)
→ review
→ processing
→ pending_upload
→ uploading
→ ready
→ final
→ attract

recoverable branches:
camera_error, upload_failed, interrupted
```

SQLite tables must include:

- `settings`: passcode hash/salt, active frame, four normalized slots, crop modes, Google Forms URL, retention/LAN settings.
- `sessions`: opaque ID, timestamps, state, local source paths, collage path, public token/URL, expiry, last error.
- `upload_jobs`: session ID, state, attempt count, next attempt time, error details, timestamps.
- `audit_log`: settings/passcode/retry operations only; no guest identity or Google Form responses.

Use database transactions for state transitions that create/update upload jobs. Store timestamps in UTC. Keep filesystem writes atomic through temporary-file then rename. On startup, reconcile SQLite records with files on disk and recover safely.

Run local cleanup at startup and on a daily interval. Delete local originals/collages after 60 days and record only non-sensitive cleanup results.

## Image pipeline

1. Load the four source JPEGs and configured frame.
2. Validate file type, dimensions, orientation, and upper size limits.
3. Correct EXIF orientation.
4. Determine crop using face bounds when available; fall back deterministically to center crop.
5. Resize/crop each photo exactly once to its output slot.
6. Composite photos in slot order and transparent frame overlay last.
7. Encode one optimized sRGB JPEG at quality appropriate for a 2500–3000 px long edge.
8. Write atomically to the local completed directory.
9. Return dimensions, byte size, timing breakdown, and output path for logging/tests.

The pipeline must be deterministic for the same settings and inputs. Add fixture-based visual/golden tests with a documented tolerance; never assert only that “a file exists.”

## Supabase backend contract

Use a Singapore-region hosted project for production, but support a local Supabase stack for development.

### Database

Create a checked-in migration for `photo_sessions` with at least:

- UUID primary key/internal session ID
- `public_token_hash` (store a cryptographic hash, not the raw QR token)
- private Storage object path
- `status`: `pending | ready | expired | deleted`
- content type and byte size
- Google Forms URL snapshot
- `created_at`, `ready_at`, `expires_at`, `deleted_at`

Index token hash and expiry/status cleanup queries. Enable Row Level Security and deny direct anonymous table access. Storage bucket `photos` must be private with restrictive policies.

### Auth

- `create-upload` and `confirm-upload` require a valid dedicated booth-user JWT.
- The public `photo` function does not require Supabase Auth; it validates the random 256-bit opaque token by hashing it and looking up the ready, unexpired record.
- `cleanup-expired` requires a server-side scheduled-call secret or an equivalent Vault-protected scheduled invocation.
- Secret/service-role access exists only inside Edge Functions.

### `create-upload`

- Validate authenticated booth identity, content type, size, and request schema.
- Create a pending row, generate a 256-bit opaque token, store only its hash, allocate an opaque private Storage path, and return short-lived upload authorization.
- Never accept caller-controlled final bucket paths.

### `confirm-upload`

- Validate booth JWT and ownership/device association.
- Verify the object exists with expected type/size.
- Mark the row ready, set `ready_at` and `expires_at = ready_at + 30 days`, and return the public URL containing the raw opaque token.
- Be idempotent so upload-recovery retries are safe.

### `photo`

- Validate token shape, hash it, and fetch only a `ready` unexpired record.
- Return a branded, responsive public page derived from the Grace Booth design tokens.
- Page contains the finished image, primary Download button, optional Ministry Registration button for the validated HTTPS Google Forms URL, and “available for 30 days” copy.
- Provide the private photo through a very short-lived signed URL or a controlled response.
- Use secure headers, strict content types, `noindex`, non-cacheable token HTML, and download-friendly `Content-Disposition`.
- Return friendly not-found/expired states without revealing whether a token ever existed.

### Cleanup

- Scheduled daily through Supabase Cron/`pg_cron` plus `pg_net` and Vault, or an equally secure supported mechanism.
- Delete Storage objects using the Storage API, then mark/delete records idempotently.
- Public access must stop at exact `expires_at` even if cleanup runs later.

## Public and local security

- Generate the QR token with a cryptographically secure RNG; minimum 256 bits.
- Never log raw QR tokens, signed URLs, Auth tokens, passcodes, service keys, or guest-photo URLs.
- Validate uploaded PNG/JPEG signatures and decode them before use; do not trust extensions.
- Enforce conservative file-size and pixel-dimension limits.
- Use parameterized DB access and schema validation at every boundary.
- Add reasonable request size limits and rate limiting/abuse protection where supported without adding a new cloud vendor.
- Add a Content Security Policy appropriate to the public page and Electron renderer.
- Google Forms registration is optional and external. Do not collect or proxy form data.

## Root scripts and developer experience

Provide root scripts with stable names:

```text
pnpm dev:kiosk
pnpm dev:supabase
pnpm supabase:start
pnpm supabase:stop
pnpm db:reset
pnpm functions:serve
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm dist:win
```

Create `.env.example` using placeholders only. No real credentials. Document which settings are main-process-only and which publishable Supabase key may be exposed. Keep all secrets out of Git.

## Implementation phases

Work continuously through the phases unless a stop condition applies. Keep no more than one phase marked in progress.

### Phase 0 — inspect and scaffold

- Read canonical inputs completely.
- Record an implementation plan.
- Scaffold the workspace, strict TypeScript configs, root scripts, lint/test tooling, shared schemas, and Electron security baseline.

### Phase 1 — faithful UI and mock guest flow

- Port the seven Grace Booth artboards into React.
- Implement the state machine and full mouse-controlled mock-camera flow.
- Verify at exactly 1366 × 768 and also at 1280 × 720.

### Phase 2 — local DB, frame editor, and image pipeline

- Add migrations/repositories, admin passcode, frame/slot persistence, Sharp composition, MediaPipe strategy/fallback, retention, and crash-safe recovery.

### Phase 3 — Supabase delivery

- Add migrations, private bucket policies, Edge Functions, booth Auth contract, upload queue, confirmation, QR, public page, signed download, and cleanup schedule.
- Local Supabase tests must pass. Do not create or deploy a real hosted project without permission.

### Phase 4 — hardening and packaging

- Add failure injection, restart recovery, security tests, image golden tests, accessibility checks, Electron packaging, Windows build instructions, and Sony integration documentation.
- Run the complete verification suite and fix failures within scope.

## Verification requirements

Run and report:

- dependency install
- lint and formatting check
- strict TypeScript check
- unit/integration tests
- image-pipeline fixture/golden tests
- Supabase migration reset and Edge Function tests when Docker is available
- Playwright/Electron happy path: Start → four captures → review → process → mocked/real local Supabase confirmation → QR → Done
- retake flow
- camera-failure flow
- upload retry and restart-recovery flow
- expired-token behavior
- production build
- Windows packaging where supported by the environment

Visually compare the implemented screens with the reference HTML at 1366 × 768. Capture screenshots for each screen and inspect them. Do not call the UI complete based only on DOM tests.

If Docker, a hosted Supabase project, Windows packaging, or real camera hardware is unavailable, complete every test that can run, clearly mark the unavailable verification, and leave deterministic commands for the user. Lack of external hardware is not permission to fake results.

## Acceptance criteria

- [ ] All seven implemented kiosk/admin screens closely match `grace-booth-wireframes` at 1366 × 768 without prototype presentation chrome.
- [ ] A guest can complete, retake, process, upload, scan, and finish a four-photo session in mock mode using a mouse.
- [ ] QR is impossible to display before `confirm-upload` returns a ready public URL.
- [ ] Completed work survives app restart and failed uploads resume from SQLite/local files.
- [ ] Frame editor persists four normalized slots and produces a deterministic 2500–3000 px JPEG collage.
- [ ] Public photos live in a private Supabase Storage bucket and are accessible only through validated, unexpired opaque-token flow.
- [ ] Raw QR tokens and all privileged keys are absent from logs, database fields, renderer code, and committed files.
- [ ] Public access expires at exactly 30 days; cloud cleanup and 60-day local cleanup are implemented and tested.
- [ ] Google Forms remains optional and external.
- [ ] Real Sony support is honestly marked pending model verification; mock mode is complete and tested.
- [ ] Lint, typecheck, unit/integration tests, accessible focus behavior, production build, and available E2E tests pass.
- [ ] `README.md`, `SETUP.md`, `.env.example`, and Sony integration documentation match the actual implementation.

## Scope and forbidden actions

Work only inside:

`C:\Users\padil\mj\photobooth-system`

Read but never modify:

- `C:\Users\padil\mj\grace-booth-wireframes`
- `C:\Users\padil\mj\obsidian-vault\iMac Vault\6 - Main Notes\photobooth-system\Photobooth System - Architecture and Build Plan.md`

Do not:

- deploy or create live Supabase resources without permission
- expose or request secrets in chat/output
- modify files outside the implementation workspace
- push to Git or rewrite repository history
- delete user files
- add unrelated product features
- replace the locked stack or architecture
- use webcam-quality capture as the production Sony solution
- claim tests passed unless they actually ran

## Stop conditions

Stop and ask before:

- deleting or overwriting an existing user file
- changing the approved architecture, retention policy, guest flow, or UI direction
- adding a dependency outside the approved categories
- making a destructive database change
- provisioning/deploying an external service
- integrating Sony SDK binaries or choosing a model-specific capture strategy
- touching anything outside the target workspace
- continuing after the same unresolved failure has occurred twice

Do not stop for routine implementation decisions that stay within this brief. Make sensible, documented choices and continue.

## Progress and completion response

Begin by summarizing the inspected source-of-truth files and posting a concrete implementation plan. After each phase, report:

`✅ Phase N — completed outcome — key files — verification performed`

At completion, provide:

1. Outcome summary.
2. Final repository tree.
3. Every command/test run and its result.
4. Any verification blocked by unavailable Docker, Supabase account, Windows packaging, or camera hardware.
5. Exact next steps from `SETUP.md`.
6. Every file added or materially changed.

This prompt is for an agentic tool with real system access. Obey the scope locks, forbidden actions, and stop conditions throughout the build.
