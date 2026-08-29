import type { NextConfig } from "next";

// Baseline security headers. Vercel already sends HSTS; these cover the rest.
// No CSP yet: Next.js injects inline scripts for hydration, so a correct policy needs nonces —
// worth doing, but it breaks the app if got wrong, so it's deliberately left as a follow-up
// rather than shipped untested.
const securityHeaders = [
  // The app has no reason to be embedded anywhere — blocks clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  // Stops browsers MIME-sniffing a response into something executable.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which can carry invite codes) to third-party sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app uses none of these APIs.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // don't advertise the framework version
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
