# Native iOS notifications

The browser Web Push API is unchanged. Native endpoints are separate:

- POST /api/apns/devices: upsert a subscription.
- DELETE /api/apns/devices: idempotent removal using the same installation secret.
- GET /api/apns/dispatch: scheduler only, requires Authorization: Bearer CRON_SECRET.

POST JSON: deviceToken (64–200 lowercase hex characters, even length), installationSecret (64 lowercase hex), platform='ios', bundleId, environment='development'|'production', lineIds (0–44 known supported IDs), preferences={enabled,includeCommunity,suspension,resumption,delay} (all booleans). DELETE uses the same identity fields without preferences/lineIds.

The iOS client creates its random installation secret in Keychain and sends it only over HTTPS. Redis stores its SHA-256 hash, not the secret. An atomic Lua operation prevents overwriting/removing another installation's token. Tokens and settings are AES-256-GCM encrypted at rest. Records expire after 180 days; unsubscription removes the device and transition state. JSON body limit 4 KiB; browser origin checks; 30 mutations per source per 10 minutes; no in-memory production fallback; maximum 500 registrations. No tokens, bodies or addresses are logged.

Server-only environment variables:

- Existing KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH equivalents).
- APNS_STORAGE_KEY: 32 random bytes encoded as 64 lowercase hex. Store securely; rotation requires a migration or subscriptions will need registration again.
- APNS_BUNDLE_ID: approved iOS bundle identifier.
- APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY: existing Apple APNs signing key. Never copy to the iOS repository.
- CRON_SECRET: scheduler authentication.
- APNS_DELIVERY_ENABLED=true only after sandbox verification.
- APNS_PRODUCTION_DELIVERY_APPROVED=true only after the owner's explicit production-push approval.

No key or certificate is created by this change. No schedule is enabled. Deploying this PR without configuration keeps native registration at 503 and sends no pushes. Configure a one-minute authenticated scheduler after verifying the current Vercel plan supports it without unexpected charges. A 330-second ownership lease prevents overlapping dispatch runs. Processing batches of 20 sends at most one push per device per invocation (multiple official changes are summarized), with a 10-second APNs timeout. Scale beyond 500 requires a durable queue and load test before increasing the cap.

First official snapshot establishes a baseline without sending historical alerts. Fresh official changes drive suspension/resumption and optional delay alerts; stale data, mock responses, position-derived delay text and unknown states do not trigger official notifications. User reports use the existing five-minute distinct-source spike rule and a 30-minute per-device/line cooldown, always with qualified language. Invalid/expired APNs devices are removed. Delivery failure retains old official state for retry; community cooldown favors avoiding duplicate user-report alerts.

Before release: test registration, owner mismatch, deletion, expiry, token rotation, permission denial, sandbox delivery and TestFlight environment; review privacy disclosures. Production delivery and scheduler activation need owner approval. The app's APNS_REGISTRATION_URL stays unset until the deployed backend passes those checks.

Community compatibility: optional event='resumed' is accepted only with status='on-time'. Old clients still receive the existing statuses; resumedCount is included only when applicable. It never becomes official information.
