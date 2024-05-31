import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/** The portfolio that shows Footnote in a window. */
const PORTFOLIO = "https://uzair-khan-lac.vercel.app";

// A page of Footnote loads only its own files and asks only its own server for
// data (the filings it searches are static files next to it). Nothing comes from
// another site, so text from a filing that somehow came to be treated as code
// could neither fetch a script from elsewhere nor send what it read anywhere.
//
// 'unsafe-inline' is there because Next.js writes small scripts into each page
// (its starting data, and the one that sets the theme before the first paint).
// What keeps a filing's text from becoming code is that it is only ever drawn
// as text; this policy is the second fence.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `frame-ancestors 'self' ${PORTFOLIO}`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // Development only: lets the dev server be opened as 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
