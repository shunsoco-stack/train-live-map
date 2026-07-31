# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately to
`train-live-map-support@gmail.com`. Do not include access tokens, private keys,
push subscription credentials, or other secrets in a public issue.

## Security model

- The public map has no user account, administrator role, or authenticated session.
- Community reports are intentionally anonymous. Server-side HMAC pseudonyms,
  per-source limits, per-reporter cooldowns, strict JSON validation, and
  same-origin browser checks reduce abuse; they do not provide proof of identity.
- ODPT, Redis, and VAPID credentials are server-only environment variables.
- Web Push endpoints are limited to known HTTPS push-service domains.
- Debug data is unavailable when `NODE_ENV=production`.

## Deployment requirements

- Keep `ODPT_ACCESS_TOKEN`, Redis credentials, `VAPID_PRIVATE_KEY`, and
  `COMMUNITY_REPORT_HMAC_SECRET` out of Git and client-visible variables.
- Use a dedicated random `COMMUNITY_REPORT_HMAC_SECRET` of at least 32 characters.
- Scope production secrets to Production and use separate values for Preview.
- Enable provider-side rate limits, Vercel deployment protection for previews,
  GitHub secret scanning, Dependabot alerts, and branch protection.
- Rotate a secret immediately if it is ever printed, shared, or committed.

## Supported version

Only the current production deployment and the latest commit on `main` receive
security fixes.
