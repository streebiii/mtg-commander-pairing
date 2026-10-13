import type { NextConfig } from "next";

// Sicherheits-Header, die für jede Antwort gesetzt werden (siehe SPEC.md
// Abschnitt 2 "Sicherheitshärtung"). Verhindern u.a. Clickjacking (Framing
// durch fremde Seiten), MIME-Sniffing und übermässiges Referrer-Leaking.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // HSTS: erzwingt HTTPS für ein Jahr, inkl. Subdomains. Auf Vercel ist die
  // Seite ohnehin nur über HTTPS erreichbar, das hier verhindert zusätzlich
  // ein Downgrade auf HTTP bei erneuten Besuchen.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Erfassung und Achievement-Katalog sind in die Ligaverwaltung gezogen
  // (SPEC.md Abschnitt 14) — alte Lesezeichen sollen weiter funktionieren.
  async redirects() {
    return [
      {
        source: "/admin/erfassung/tischkarten",
        destination: "/admin/ligaverwaltung/tischkarten",
        permanent: false,
      },
      { source: "/admin/erfassung/:path*", destination: "/admin/ligaverwaltung", permanent: false },
      {
        source: "/admin/achievements",
        destination: "/admin/ligaverwaltung/achievements",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
