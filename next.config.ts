import type { NextConfig } from "next";

// Security headers, applied to every route. Uses next.config.js's plain
// headers() rather than a nonce-based CSP (see Next's own docs on this) —
// nonces require every page to opt into dynamic rendering, which would
// mean touching nearly every route in this app just to carry a header.
// That's a much bigger, more invasive change than "add security headers,"
// and this project's standing rule is to preserve everything else
// untouched. The trade-off is 'unsafe-inline' on script-src/style-src
// (style-src also needs it regardless, for Motion's runtime inline
// styles) — a real, disclosed reduction in XSS defense versus a strict
// nonce-based CSP, not a silent one. See STATUS.md.
//
// challenges.cloudflare.com is allowed ahead of the Turnstile CAPTCHA
// integration (a separate, still-pending piece of this hardening pass) so
// this header doesn't need touching again once that lands.
const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
];

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
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
