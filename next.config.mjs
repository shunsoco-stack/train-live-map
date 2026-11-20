const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://adm.shinobi.jp https://*.shinobi.jp https://*.cnobi.jp",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org https://*.shinobi.jp https://*.cnobi.jp",
  "font-src 'self' data:",
  "connect-src 'self' https://tiles.openfreemap.org https://*.shinobi.jp https://*.cnobi.jp",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src https://*.shinobi.jp https://*.cnobi.jp",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: cspReportOnly,
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
